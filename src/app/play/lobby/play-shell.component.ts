/**
 * play-shell.component.ts — /play: the title screen, the character list, the Glass for a new Keeper, then the world.
 *
 * Owner, 2026-10-21: "we also need a login and select character screen" (Tibia: log in, see your characters, pick one
 * or make a new one, enter the world) — and "if I'm already logged in, it should go to character screen".
 *
 *   signed out, never chose        → title (Sign in with Google · Play offline)
 *   signed in, or chose offline    → character list (a quiet "waking" screen while a signed-in session resumes): the
 *                                    Keepers round a campfire, Diablo II style (camp-art.ts; owner, 2026-10-21)
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
import { MAX_CHARACTERS, PRIMARY_CHARACTER, newCharacterId, readProfile } from '../../shared/save/character-scope';
import { CloudSaveService, hasBoundAccount } from '../../shared/cloud-save/cloud-save.service';
import { CharacterRosterService } from '../../shared/characters/character-roster.service';
import { CharacterRow, confirmsDelete, hasFreeSlot, idForNewCharacter, junkRowIds, needsTypedName, portraitOf } from '../../shared/characters/character-roster.model';
import { KEEPER_LOOK_I18N } from '../../shared/keeper-look/keeper-look.i18n';
import { type KeeperLook, type Vocation, VOCATIONS, coerceLook } from '../../shared/keeper-look/keeper-look.model';
import { KeeperLookService } from '../../shared/keeper-look/keeper-look.service';
import { KeeperMakerComponent } from '../../shared/keeper-look/keeper-maker.component';
import { equippedInLedger, wornGear } from '../../shared/keeper-look/worn-gear';
import { packWorn } from '../../shared/keeper-look/worn-looks';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { INVENTORY_KEY } from '../../shared/rpg/inventory.service';
import { FeedbackSheetComponent } from '../../shared/feedback/feedback-sheet.component';
import { FEEDBACK_I18N } from '../../shared/feedback/feedback.i18n';
import { SideScrollerComponent } from '../side-scroller.component';
import { StoryService } from '../../shared/story/story.service';
import { LOBBY_I18N } from './lobby.i18n';
import { LORE_I18N } from '../../shared/lore/lore.i18n';
import { lorePage } from '../../shared/lore/lore';
import { paintTitleArt, titleArtSize } from './title-art';
import { CAMP_SLOTS, CampArt, type CampFigure, type CampLayout, type Rect, campLayout, spotBox } from './camp-art';
import { hasMeaningfulSave, summarise } from './character-summary';
import { PlaySessionService, type PlaySessionState } from '../../shared/save/play-session.service';
import {
  LOBBY_ENTER_KEY, LOBBY_FROM_KEY, LOBBY_GUEST_KEY, LOBBY_MAKE_KEY, LOBBY_SKIP_KEY, LobbyMode, PlayLobbyService, initialLobbyMode, mayUsePrimarySlot,
} from './play-lobby.service';

/** The title art's frame rate: slow motion needs few frames, and a phone on the title screen should stay cool. */
const ART_FPS = 12;
/** How long a resuming sign-in may hold the quiet "waking" screen before the list shows anyway. */
const AUTH_WAIT_MS = 8000;

/** The Wanewalker's shape by the fire: a hooded, robed figure (painted as a pale silhouette). */
const GHOST_LOOK: KeeperLook = coerceLook({ made: true, vocation: 'warlock', form: 'fem', hair: 'long' });

/** The four callings by the fire on the Glass, each with a look of its own so they read as four people. */
const CLASS_FIGURES: ReadonlyArray<{ vocation: Vocation; look: KeeperLook }> = VOCATIONS.map((vocation, i) => ({
  vocation,
  look: coerceLook({ made: true, vocation, ...[{}, { body: 'broad', hair: 'cropped', hairColor: 1 }, { body: 'slight', hair: 'braid', hairColor: 3 }, { hair: 'swept', hairColor: 2, skin: 2 }][i] }),
}));

@Component({
  selector: 'app-play-shell',
  standalone: true,
  imports: [SideScrollerComponent, KeeperMakerComponent, FeedbackSheetComponent],
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
  private readonly looks = inject(KeeperLookService);
  private readonly session = inject(PlaySessionService);
  /** One live session per account (play-session.service): 'wait' while the tab lock answers, then play or the takeover. */
  worldGate: 'wait' | 'play' | 'elsewhere' = 'wait';
  sessionState: PlaySessionState = this.session.state;
  takingOver = false;

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
  /** The Send feedback form over the title or the campfire. */
  feedbackOpen = false;
  typed = '';
  readonly max = MAX_CHARACTERS;

  private artEl: HTMLCanvasElement | null = null;
  @ViewChild('art') set art(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.artEl = ref?.nativeElement ?? null;
    if (this.artEl) this.startArt();
  }
  @ViewChild('deleteInput') deleteInput?: ElementRef<HTMLInputElement>;
  @ViewChild('deleteGo') deleteGo?: ElementRef<HTMLButtonElement>;
  /** The Glass's maker: its chosen calling steps forward by the fire. */
  @ViewChild(KeeperMakerComponent) maker?: KeeperMakerComponent;

  /** The campfire's stage (the box the group is centred in); watched, so the scene follows the page's layout. */
  private stageEl: HTMLElement | null = null;
  private stageObserver: ResizeObserver | null = null;
  @ViewChild('stage') set stage(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.stageEl) return;
    this.stageObserver?.disconnect();
    this.stageObserver = null;
    this.stageEl = el;
    if (!el || !this.browser) return;
    if (typeof ResizeObserver === 'function') {
      this.stageObserver = new ResizeObserver(() => this.zone.run(() => this.relayout()));
      this.stageObserver.observe(el);
    } else {
      setTimeout(() => this.relayout());
    }
  }
  /** Each place's box over the stage (CSS px), where the Keepers' buttons sit; empty until the stage is measured. */
  boxes: Rect[] = [];
  readonly classes = CLASS_FIGURES.map(f => f.vocation);
  private readonly camp = new CampArt();
  private layout: CampLayout | null = null;
  /** Something the scene shows changed: paint again (with reduced motion, the only reason to paint). */
  private dirty = true;
  /** The Glass's look as last painted (its calling and painting fields): a change paints again. */
  private lastDraft = '';
  private readonly rowLooks = new Map<string, KeeperLook>();

  private raf = 0;
  private lastFrame = 0;
  private artStart = 0;
  private reduced = false;
  private subs: Subscription[] = [];

  constructor() {
    this.i18n.register(LOBBY_I18N);
    this.i18n.register(FEEDBACK_I18N);
    this.i18n.register(KEEPER_LOOK_I18N);
    this.i18n.register(LORE_I18N);
  }

  /** The Wanewalkers' quote, for the Glass's locked figure. */
  get ghostQuote(): string { return this.t(lorePage('wanewalkers')?.quote ?? ''); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  get signedIn(): boolean { return this.cloud.signedIn; }
  /** The cloud is pulling this account's save (the roster among it): New Keeper waits, so it cannot land on a slot it has not seen. */
  syncing = false;
  get account(): string { return this.cloud.status.displayName || this.cloud.status.email || ''; }
  get full(): boolean { return !hasFreeSlot(this.roster.roster); }
  get pickedRow(): CharacterRow | null { return this.rows.find(r => r.id === this.picked) ?? null; }
  get deleteName(): string { return this.deleting ? this.nameOf(this.deleting) : ''; }
  get deleteReady(): boolean { return !!this.deleting && confirmsDelete(this.deleting, this.typed); }
  /** A named Keeper's delete asks for the name; a nameless one's is a plain confirm. */
  get deleteTyped(): boolean { return !!this.deleting && needsTypedName(this.deleting); }

  ngOnInit(): void {
    if (!this.browser) return;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.subs.push(this.lobby.selectRequested$.subscribe(() => void this.leaveWorld()));
    this.subs.push(this.roster.roster$.subscribe(() => this.refreshRows()));
    // Another device or tab took this account (or held it first): the world gives way to the takeover screen.
    this.subs.push(this.session.state$.subscribe(st => this.zone.run(() => {
      this.sessionState = st;
      if (st.role === 'elsewhere' && this.mode === 'game') { this.worldGate = 'elsewhere'; this.dirty = true; }
    })));
    this.subs.push(this.cloud.status$.subscribe(st => { const now = st.state === 'syncing'; if (now !== this.syncing) this.zone.run(() => { this.syncing = now; }); }));
    // Summaries wait for the cloud pull (sync fix, 2026-10-21): a list drawn mid-sync re-summarises once it lands.
    this.subs.push(this.cloud.status$.pipe(filter(s => s.state !== 'syncing')).subscribe(() => {
      if (this.mode === 'select') this.zone.run(() => this.ensureRoster());
    }));
    void this.decide();
  }

  ngAfterViewInit(): void {
    if (this.artEl) this.startArt();
  }

  ngOnDestroy(): void {
    this.stopArt();
    this.stageObserver?.disconnect();
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
      // Only a Keeper never made is discarded (an abandoned Glass earns a little XP just by booting, so XP is no
      // sign). A MADE Keeper whose row is missing here (this device's roster written over by a stale copy, e.g.
      // another tab) gets its row back instead: deleting it would wipe the whole character, and on a signed-in page
      // its documents too. A tombstone (deleted on purpose) still discards.
      if (this.roster.roster.chars[character] || !coerceLook(this.gateway.read('godforge-keeper-look')).made) {
        await this.discardAndReturn(character);
        return;
      }
      this.roster.put(summarise(this.gateway, { id: character, name: '', vocation: 'warlock', level: 1, area: '', look: null, createdAt: Date.now(), updatedAt: 0 }));
    }
    const signedIn = hasBoundAccount();
    let target = initialLobbyMode({ character, skip, enter, make, signedIn, guest });

    // A returning signed-in player: no title flash. Wait (quietly) for the session to resume, so the list and the
    // world hold the cloud's copy; a session that lapsed falls back to the title.
    if (signedIn && target !== 'title' && !skip) {
      this.cloud.init();
      await this.authSettled();
      if (!this.cloud.signedIn && target === 'select' && !guest) target = 'title';
      // The session lapsed into Play offline: this page booted into the account's saves, the guest must not see them
      // (character-scope "Profiles"). Reload into the guest's own.
      if (!this.cloud.signedIn && readProfile(localStorage) !== this.gateway.profile) { location.reload(); return; }
    }
    if (target === 'game' && !skip && this.unfinished(character)) target = 'create';
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
      if (this.cloud.status.state !== 'syncing') this.ensureRoster();
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
    if (mode === 'game' && this.browser) {
      this.worldGate = this.session.elsewhere ? 'elsewhere' : 'wait';
      void this.session.enterWorld().then(st => this.zone.run(() => {
        if (this.mode !== 'game') return;
        this.worldGate = st.role === 'play' ? 'play' : 'elsewhere';
        this.dirty = true;
      }));
    }
    this.mode = mode;
    this.dirty = true;
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

  async playOffline(): Promise<void> {
    try { localStorage.setItem(LOBBY_GUEST_KEY, '1'); } catch { /* private mode: asked again next time */ }
    // A browser an account has signed in on: the guest plays its own saves, never the account's (character-scope
    // "Profiles"). The profile is fixed per page, so a page booted into the account's reloads into the guest's.
    if (this.browser && readProfile(localStorage) !== this.gateway.profile) {
      this.busy = true;
      await this.gateway.settleForReload();
      location.reload();
      return;
    }
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
    this.pruneJunk();
  }

  /**
   * Drop the junk rows the old "leaving New Keeper still creates a Keeper" bug wrote (character-roster.model.ts
   * isJunkRow: nameless, level 1, nowhere, never c1 or the Keeper in play, nothing meaningful saved here), once the
   * cloud has settled. A tombstone, as Delete leaves, so the removal syncs; no save is touched (boot-time cleanup never
   * deletes in the cloud).
   */
  private pruneJunk(): void {
    const settled = this.cloud.status.state !== 'syncing'
      && mayUsePrimarySlot({ bound: hasBoundAccount(), signedIn: this.cloud.signedIn, state: this.cloud.status.state, lastSyncedAt: this.cloud.status.lastSyncedAt });
    const junk = junkRowIds(this.roster.roster, { settled, active: this.gateway.character, hasSave: id => hasMeaningfulSave(this.gateway, id) });
    for (const id of junk) this.roster.tombstone(id);
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
    if (this.picked && !this.rows.some(r => r.id === this.picked) && this.mode === 'select') this.picked = this.rows[0]?.id ?? null;
    this.dirty = true;
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

  pick(id: string): void {
    if (this.busy) return;
    this.picked = id;
    this.notice = '';
    this.dirty = true;
  }

  /**
   * The campfire's keys: arrows cycle the Keepers round the fire, Enter enters the world as the chosen one. Only on
   * the list with nothing over it, and never from a field (or Enter from another button, which presses that button).
   */
  @HostListener('document:keydown', ['$event'])
  onCampKey(event: KeyboardEvent): void {
    if (this.mode !== 'select' || this.busy || this.deleting || !this.rows.length || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    // Enter is the world's from the page itself or a Keeper by the fire (the free place's Enter opens the Glass).
    const inCamp = !target || target === document.body || (!!target.closest('[data-camp-stage]') && !target.closest('[data-camp-new]'));
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      event.preventDefault();
      const at = this.rows.findIndex(r => r.id === this.picked);
      const next = this.rows[((at < 0 ? (step > 0 ? -1 : 0) : at) + step + this.rows.length) % this.rows.length];
      this.pick(next.id);
      setTimeout(() => document.querySelector<HTMLElement>(`[data-character="${next.id}"]`)?.focus());
    } else if (event.key === 'Enter' && inCamp && this.picked) {
      event.preventDefault();
      void this.enter();
    }
  }

  /** The look a row's Keeper is painted with by the fire (its class from the row, whatever the look says). */
  rowLook(row: CharacterRow): KeeperLook {
    const key = row.vocation + '#' + JSON.stringify(row.look);
    let look = this.rowLooks.get(key);
    if (!look) {
      look = coerceLook({ ...(row.look ?? {}), made: true, vocation: row.vocation });
      this.rowLooks.set(key, look);
    }
    return look;
  }

  /** What a row's Keeper wears, read from its save on this device (cached per row revision); null when there is none here. */
  private rowGear(row: CharacterRow): KeeperGear | null {
    const key = `${row.id}@${row.updatedAt}`;
    if (this.rowGears.has(key)) return this.rowGears.get(key)!;
    let gear: KeeperGear | null = null;
    try { if (this.gateway.hasLocalSave(row.id)) gear = wornGear(equippedInLedger(this.gateway.readFor(row.id, INVENTORY_KEY))); } catch { gear = null; }
    this.rowGears.set(key, gear);
    return gear;
  }
  private readonly rowGears = new Map<string, KeeperGear | null>();

  /** The free place by the fire ("New Keeper"), or null when there is none. */
  get emptySpot(): number | null {
    return this.mode === 'select' && !this.full && this.rows.length < CAMP_SLOTS.length ? this.rows.length : null;
  }

  /** On the Glass: a calling by the fire was clicked (the maker's own cards do the same, and say which is chosen). */
  /** The locked fifth figure's note (the lore's quote) is open. */
  lockedTip = false;

  chooseClass(v: Vocation): void {
    this.maker?.setVocation(v);
    this.dirty = true;
  }

  /** Enter the world as `id`: at once when it is the character this page plays, else save, switch and reload. */
  async enter(id: string | null = this.picked): Promise<void> {
    if (!id || this.busy || !this.roster.row(id)) return;
    if (id === this.gateway.character) {
      this.go(this.unfinished(id) ? 'create' : 'game');
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
    setTimeout(() => (this.deleteInput ?? this.deleteGo)?.nativeElement.focus());
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

  /**
   * A Keeper on the list whose look was never made on this device or in the cloud: its Glass was never finished,
   * or its look never reached the cloud (owner, 2026-10-21: "I created a ranger … when logging back in, the character
   * looked like a warlock"). Rather than drop it into the world as the default Warlock, the Glass opens on the row's
   * name, class and portrait (prefilled, never auto-converted) and Become finishes it. Only once this page knows the
   * cloud's copy (or the device is not bound to an account): a pull still under way may yet bring the look down.
   * Character #1 without a name is a save from before the Glass, which keeps the in-world offer instead.
   */
  private unfinished(id: string): boolean {
    const row = this.roster.row(id);
    if (!row || id !== this.gateway.character || (id === PRIMARY_CHARACTER && !row.name)) return false;
    if (coerceLook(this.gateway.read('godforge-keeper-look')).made) return false;
    const known = mayUsePrimarySlot({ bound: hasBoundAccount(), signedIn: this.cloud.signedIn, state: this.cloud.status.state, lastSyncedAt: this.cloud.status.lastSyncedAt });
    if (!known) return false;
    const vocation = coerceLook({ vocation: row.vocation }).vocation;
    this.looks.prefill({ ...coerceLook(row.look ?? {}), name: row.name, vocation });
    this.picked = id;
    return true;
  }

  /** "I've played before: skip the tutorial" on the Glass (off by default: a new Keeper is taught the island). */
  skipTutorial = false;

  made(look?: KeeperLook): void {
    // Become was pressed: NOW the Keeper exists, and goes on the list.
    const now = Date.now();
    const made = look ?? coerceLook(this.gateway.read('godforge-keeper-look'));
    const id = this.gateway.character;
    const row = this.roster.row(id);
    // The row is the Glass's choice — name, class and portrait — never a later summary's default.
    this.roster.put({ id, name: made.name, vocation: made.vocation, level: row?.level ?? 1, area: row?.area ?? '', look: portraitOf(made), createdAt: row?.createdAt || now, updatedAt: Math.max(now, (row?.updatedAt ?? 0) + 1) });
    // The look and the row go up now, not on the debounce: a tab closed (or a phone's browser killed) in the next
    // few seconds must not leave a Keeper whose class exists only on this device.
    void this.gateway.pushNow().catch(() => { /* offline: queued, and marked for any later signed-in page */ });
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
    // A Keeper that exists (made, or on the list with a name or a save: the recovery Glass) is never discarded here.
    const row = this.roster.row(id);
    if (row && (look.made || row.name)) { this.leaveGlassHistory(); this.zone.run(() => this.go('select')); return; }
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

  /** The takeover screen's line: another device (named when the lease knows it) or another tab of this browser. */
  get elsewhereLine(): string {
    const st = this.sessionState;
    if (st.why === 'tab') return this.t('lobby.session.tab');
    return st.device ? this.t('lobby.session.deviceNamed', { device: st.device }) : this.t('lobby.session.device');
  }
  /** "Play here": this session takes the account (the other one stops), and the page reloads into the world. */
  async playHere(): Promise<void> {
    if (this.takingOver) return;
    this.takingOver = true;
    try { await this.session.playHere(LOBBY_ENTER_KEY, this.gateway.character); }
    finally { this.zone.run(() => { this.takingOver = false; }); }
  }

  private async leaveWorld(): Promise<void> {
    if (this.mode !== 'game' || this.busy) return;
    this.busy = true;
    await this.gateway.settleForReload();
    this.zone.run(() => {
      this.busy = false;
      this.go('select');
    });
  }

  // ── The painting: the title's night, or the campfire ───────────────────────

  /** Measure the lobby and the stage, lay the campfire out, and place the Keepers' buttons over it. */
  private relayout(): void {
    const m = this.measure();
    this.layout = m?.layout ?? null;
    const stage = m?.stage ?? null;
    const layout = this.layout;
    this.boxes = layout && stage ? CAMP_SLOTS.map((_, i) => spotBox(layout, i, stage)) : [];
    this.dirty = true;
  }

  private measure(): { layout: CampLayout; stage: Rect | null } | null {
    const lobby = this.artEl?.parentElement;
    if (!lobby) return null;
    const lr = lobby.getBoundingClientRect();
    const sr = this.stageEl?.getBoundingClientRect();
    const stage = sr && sr.width >= 40 && sr.height >= 40 ? { x: sr.left - lr.left, y: sr.top - lr.top, w: sr.width, h: sr.height } : null;
    return { layout: campLayout(lr.width, lr.height, stage), stage };
  }

  /** Who stands by the fire: the roster's Keepers (the chosen one forward), or on the Glass the four callings. */
  private figures(): CampFigure[] {
    if (this.mode === 'create') {
      // The chosen calling steps forward wearing the look being made (its hair, its colours), the others stand by.
      const draft = this.maker?.draft;
      const callings: CampFigure[] = CLASS_FIGURES.map(f => f.vocation === draft?.vocation
        ? { key: this.draftKey(), look: draft, chosen: true }
        : { key: 'class:' + f.vocation, look: f.look, chosen: false });
      // The fifth place: the Wanewalker, a calling not yet open (shared/lore), a faint figure at the back.
      return [...callings, { key: 'ghost', look: GHOST_LOOK, chosen: false, ghost: true }];
    }
    return this.rows.slice(0, CAMP_SLOTS.length).map(row => {
      // Each Keeper by the fire wears what it wore when it last left the world (its own save on this device).
      const gear = this.rowGear(row);
      return { key: row.vocation + '#' + JSON.stringify(row.look) + '#' + packWorn(gear), look: this.rowLook(row), chosen: row.id === this.picked, gear };
    });
  }

  private draftKey(): string {
    const d = this.maker?.draft;
    return d ? 'draft:' + JSON.stringify([d.vocation, d.body, d.skin, d.hair, d.hairColor, d.eyes, d.eyeColor, d.face, d.outfit, d.trim]) : '';
  }

  private startArt(): void {
    if (!this.browser || !this.artEl || this.raf) return;
    const el = this.artEl;
    const draw = (seconds: number): void => {
      const c = el.getContext('2d');
      if (!c) return;
      if (this.mode === 'select' || this.mode === 'create') {
        if (!this.layout) this.layout = this.measure()?.layout ?? null;
        const l = this.layout;
        if (!l) return;
        if (el.width !== l.w || el.height !== l.h) { el.width = l.w; el.height = l.h; }
        const cw = `${l.w * l.s}px`, ch = `${l.h * l.s}px`;
        if (el.style.width !== cw || el.style.height !== ch) { el.style.width = cw; el.style.height = ch; }
        this.camp.paint(c, l, this.figures(), this.emptySpot, seconds, this.reduced);
        return;
      }
      if (el.style.width) { el.style.width = ''; el.style.height = ''; }
      const { w, h } = titleArtSize(window.innerWidth, window.innerHeight);
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      paintTitleArt(c, el.width, el.height, this.reduced ? 0 : seconds);
    };
    const resized = (): void => this.zone.run(() => this.relayout());
    window.addEventListener('resize', resized, { passive: true });
    this.stopResize = () => window.removeEventListener('resize', resized);
    this.artStart = performance.now();
    this.dirty = true;
    // One loop for both: moving, it paints ART_FPS frames a second; with reduced motion, only when something changed
    // (a pick, the list, the layout, the Glass's calling) — each of those a still frame.
    this.zone.runOutsideAngular(() => {
      const tick = (now: number): void => {
        if (!this.artEl) { this.raf = 0; return; }
        const draft = this.mode === 'create' ? this.draftKey() : '';
        if (draft !== this.lastDraft) { this.lastDraft = draft; this.dirty = true; }
        const due = this.reduced ? this.dirty || this.camp.moving : now - this.lastFrame >= 1000 / ART_FPS;
        if (due && document.visibilityState !== 'hidden') {
          this.lastFrame = now;
          this.dirty = false;
          draw((now - this.artStart) / 1000);
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private stopResize: (() => void) | null = null;

  private stopArt(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopResize?.();
    this.stopResize = null;
  }
}
