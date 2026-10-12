import { SocialRoom, RoomSnapshot } from './social/social-room';
import {
  afterNextRender, Component, ComponentRef, ElementRef, HostListener, Injector, NgZone, OnDestroy, PLATFORM_ID, ViewChild,
  ViewContainerRef, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { BASALT_SEAMWORKS_ID, CINDER_ORE_ID, EMBER_RESIDUE_ID } from '../shared/activity/activity.model';
import { InventoryService, MAX_INVENTORY } from '../shared/rpg/inventory.service';
import { GameStateGateway } from '../shared/save/game-state.gateway';
import { INVENTORY_ERA } from '../shared/rpg/inventory.model';
import { RESET_STAMP_KEY } from '../shared/save/save-reset';
import { artFor, REALM_ART } from '../shared/art/art';
import { IN_WORLD_PANEL } from '../shared/in-world-panel';
import { areaOf, REALM_TOWN_IDS, RealmTownId, StationDef, TOWN_LABELS, TOWNS, TownDef } from './world/world.model';
import { PANEL_REGISTRY } from './world/panel-registry';
import { itemArt, isBasaltEdge, materialDisplay } from '../shared/rpg/material-catalog';
import { RUNE_TIER_ORDER } from '../shared/rune-forge/rune.model';
import { definitionFor, itemFitsSlot } from '../shared/rpg/item-definition';
import {
  CHARM_SLOT_IDS, EQUIPMENT_SLOTS, GameItem, ITEM_STAT_KEYS, ItemRarity, SLOT_BY_ID, SLOT_IDS, SlotId,
  formatItemMod, rarityColor, rarityLabel,
} from '../shared/rpg/item.model';
import { KeeperCombatStats, keeperCombatStats } from '../shared/rpg/keeper-combat';
import { KeeperStatSheetComponent } from '../shared/rpg/keeper-stat-sheet.component';
import { compareStats, StatDeltaRow } from '../shared/rpg/stat-delta';
import { SeamworksEngine, EngineInput, EngineState, InteractionTarget } from './engine/engine';

const SAVE_KEY = 'eclipse-seamworks-world-v1';
const CRAFT_ID = 'seamworks-world:basalt-edge:v1';
const TUTORIAL_EMBER_ID = 'seamworks-opening:keeper-ember:v1';
const BELT: SlotId[] = ['weapon', 'off-hand', 'head', 'chest', 'hands', 'legs', 'feet', 'trinket'];

interface BagPick { kind: 'stack' | 'item' | 'slot'; ref: string; }
interface BagPocket { key: string; kind: 'stack' | 'item'; ref: string; name: string; art: string; qty: number; pip: string; mark: string; }
interface BagWell { id: SlotId; name: string; art: string; mark: string; label: string; filled: boolean; }
interface BagSlip {
  name: string; art: string; mark: string; kicker: string; note: string; stats: string[]; canWear: boolean; canStow: boolean;
  /** Wearing it, against what that place holds now. Empty for worn items and materials. */
  compare: StatDeltaRow[];
  /** "Against Basalt Edge" / "Against an empty Head". */
  compareLabel: string;
}

/** What the in-world panel is showing: a hosted page, or the waystone's travel list. */
interface OpenPlace { kind: 'page' | 'waystone'; stationId: string; title: string; kicker: string; route?: string }
interface PlaceRow { id: string; name: string; blurb: string }
interface WaystoneRow { id: RealmTownId; realm: string; town: string; crest: string; available: boolean; current: boolean }

/** How long the place's content takes to fold away. Kept in step with `place-out` in the stylesheet. */
const PANEL_CLOSE_MS = 160;
/** How long a touched station stays highlighted, with its name card up. */
const TOUCH_TIP_MS = 1400;

/** One worn piece as the engine draws it on the Keeper. */
interface LoadoutPiece { art: string; rarity: ItemRarity }
/**
 * What the engine needs to dress the Keeper. Mirrors the engine's upcoming
 * `setLoadout` contract; tightened to its exported type once that lands.
 */
interface KeeperLoadout { weapon?: LoadoutPiece; offhand?: LoadoutPiece; auraRarity?: ItemRarity }
/** The engine methods that are still landing. Called only when present. */
interface PendingEngineApi {
  setLoadout?: (loadout: KeeperLoadout) => void;
  setSatchelTarget?: (point: { x: number; y: number }) => void;
}
interface LootToast { key: number; text: string }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function titleCase(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

@Component({
  selector: 'app-side-scroller', standalone: true, imports: [RouterLink, KeeperStatSheetComponent],
  templateUrl: './side-scroller.component.html', styleUrls: ['./side-scroller.component.css'],
})
export class SideScrollerComponent implements OnDestroy {
  @ViewChild('worldCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  /**
   * Where a place's page is created. Deliberately NOT inside an @if: a
   * ViewChild in control flow is intermittently unresolved for lazily created
   * components, so the shell is always rendered (hidden when closed) and this
   * resolves statically, before any panel can open.
   */
  @ViewChild('panelHost', { read: ViewContainerRef, static: true }) panelHost!: ViewContainerRef;
  @ViewChild('placePanel', { static: true }) placePanel!: ElementRef<HTMLElement>;
  /** The station name card that follows the pointer. Written directly, outside change detection. */
  @ViewChild('stationTip', { static: true }) stationTip!: ElementRef<HTMLElement>;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  /** Pages built in the panel see IN_WORLD_PANEL and drop their full-page backdrop and hero. */
  private readonly panelInjector = Injector.create({ providers: [{ provide: IN_WORLD_PANEL, useValue: true }], parent: this.injector });
  private panelRef: ComponentRef<unknown> | null = null;
  /** Bumped on every open/close so a slow lazy import never lands in a newer (or closed) panel. */
  private panelSeq = 0;
  private atSub?: Subscription;
  /** A `?at=` that arrived before the engine existed. Applied once it mounts. */
  private pendingAt: string | null = null;
  private unbindPointer: (() => void) | null = null;
  town: TownDef = TOWNS.infernal!;
  panel: OpenPlace | null = null;
  panelLoading = false;
  panelError = '';
  /** True for the moment the place's content folds away before the panel hides. */
  closing = false;
  private closeTimer?: ReturnType<typeof setTimeout>;
  placesOpen = false;
  /** "+2 Pyrite Dust" chips over the satchel. Decorative; the objective line announces pickups. */
  lootToasts: LootToast[] = [];
  private toastKey = 0;
  private loadoutKey = '';
  private satchelKey = '';
  private tipStation: string | null = null;
  private tipTimer?: ReturnType<typeof setTimeout>;
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly inventory = inject(InventoryService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly store = inject(GameStateGateway);
  private readonly zone = inject(NgZone);
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private engine?: SeamworksEngine;
  private boundCanvas: HTMLCanvasElement | null = null;
  private room?: SocialRoom;
  social: RoomSnapshot = { status: 'Solo — join the hearth to meet other Keepers.', connected: false, players: [], messages: [], id: '' };
  joining = false;
  sending = false;
  private pendingMine: string | null = null;
  private timer?: ReturnType<typeof setInterval>;
  state: EngineState = {
    hp: 100,
    enemyHp: 100,
    nearby: null,
    x: 160,
    y: 610,
    paused: false,
    defeated: false,
    enemyDefeated: false,
    complete: false,
    message: 'Find the Cinder Ore deposit. Walk close and interact.',
    area: 'Basalt Seamworks',
  };
  restored = false;
  bagOpen = false;
  pick: BagPick | null = null;
  readonly bagCap = MAX_INVENTORY;
  showKeys = false;
  now = Date.now();
  message = '';
  /** Last combat numbers handed to the engine. Drives the HP meter's ceiling. */
  pushed: KeeperCombatStats = { damage: 10, maxHp: 100 };
  private statsKey = '';

  constructor() {
    // Hydration can swap the server canvas after the first callback. Wait until
    // the canvas that is actually on screen has a size, then draw into that one.
    afterNextRender(() => this.startWorld());
  }
  private liveCanvas(): HTMLCanvasElement | null {
    const candidates = [this.canvas?.nativeElement, this.host.nativeElement.querySelector('canvas'), document.querySelector('main.play-mode canvas')];
    for (const canvas of candidates) {
      if (canvas instanceof HTMLCanvasElement && canvas.isConnected && canvas.clientWidth >= 2 && canvas.clientHeight >= 2) return canvas;
    }
    return null;
  }
  private startWorld(): void {
    if (!this.browser) return;
    this.inventory.init();
    this.activity.init();
    const saved = this.store.read(SAVE_KEY) as { era?: number; resetAt?: string | null; restored?: boolean } | null;
    this.restored = saved?.restored === true && saved.era === INVENTORY_ERA && saved.resetAt === this.store.readRaw(RESET_STAMP_KEY);
    this.zone.runOutsideAngular(() => {
      this.room = new SocialRoom(snapshot => this.zone.run(() => {
        this.social = snapshot;
        this.engine?.setPeers(snapshot.players.filter(p => p.id !== snapshot.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
        this.engine?.setChat(snapshot.messages, snapshot.id);
      }));
      this.mountEngine();
      this.atSub = this.route.queryParamMap.subscribe(params => this.zone.run(() => this.applyAt(params.get('at'))));
      this.timer = setInterval(() => this.zone.run(() => { this.now = Date.now(); this.mountEngine(); this.pushStats(); }), 200);
    });
  }
  /** The play view can be replaced once during hydration. Follow the live canvas. */
  private mountEngine(): void {
    const canvas = this.liveCanvas();
    if (!canvas || canvas === this.boundCanvas) return;
    this.engine?.destroy();
    this.boundCanvas = canvas;
    this.engine = new SeamworksEngine(canvas, {
      assets: { keeper: this.art('keeper-base'), creature: this.art('rivet-maw'), ore: this.art(CINDER_ORE_ID), blade: this.art('basalt-edge') },
      art: key => this.art(key),
      // Scene paintings follow the ArtScene convention: assets/images/<basename>-<width>.webp.
      scene: name => `assets/images/${name}-1536.webp`,
      town: this.town,
      onInteract: (target: InteractionTarget) => this.zone.run(() => this.act(target)),
      onStation: station => this.zone.run(() => this.openStation(station)),
      onLoot: loot => loot.ore === 0 || this.zone.run(() => this.collectMaterial(loot.id, loot.material ?? CINDER_ORE_ID, loot.ore)),
      onState: (state: EngineState) => this.zone.run(() => {
        if (state.message !== this.state.message) this.message = '';
        if ((state.coins ?? 0) > (this.state.coins ?? 0)) this.bump('.coin-count');
        this.state = state;
        this.room?.update(state.x, state.y, state.area || 'Basalt Seamworks', state.facing === -1 ? -1 : 1, state.animation ?? 'idle');
      }),
    });
    this.statsKey = '';
    this.loadoutKey = '';
    this.satchelKey = '';
    this.sync();
    this.engine.setPeers(this.social.players.filter(p => p.id !== this.social.id).map(p => ({ ...p, area: p.zone, facing: p.facing, animation: p.animation })));
    this.engine.setChat(this.social.messages, this.social.id);
    this.bindPointer(canvas);
    this.engine.start();
    if (this.panel) this.engine.setPaused(true);
    if (this.pendingAt) { const at = this.pendingAt; this.pendingAt = null; this.applyAt(at); }
  }
  /**
   * Click/tap to walk and to interact, hover to highlight. Bound outside the
   * zone: a pointermove per frame must not run change detection. Anything that
   * changes component state comes back in through the engine callbacks, which
   * already re-enter the zone.
   */
  private bindPointer(canvas: HTMLCanvasElement): void {
    this.unbindPointer?.();
    this.zone.runOutsideAngular(() => {
      const move = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse' || !this.engine || this.panel) return;
        const station = this.engine.pick(event.clientX, event.clientY).station;
        this.engine.setHover(station?.id ?? null);
        canvas.style.cursor = station ? 'pointer' : '';
        this.showTip(station, event.clientX, event.clientY);
      };
      const leave = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse') return;
        this.engine?.setHover(null); canvas.style.cursor = ''; this.showTip(null, 0, 0);
      };
      // Touch has no hover: light the touched station and show its name card
      // for a beat, so a tap reads as "going there" before the Keeper arrives.
      const down = (event: PointerEvent): void => {
        if (event.pointerType === 'mouse' || !this.engine || this.panel) return;
        const station = this.engine.pick(event.clientX, event.clientY).station;
        if (!station) return;
        this.engine.setHover(station.id);
        this.showTip(station, event.clientX, event.clientY);
        if (this.tipTimer) clearTimeout(this.tipTimer);
        this.tipTimer = setTimeout(() => { this.engine?.setHover(null); this.showTip(null, 0, 0); }, TOUCH_TIP_MS);
      };
      const click = (event: MouseEvent): void => {
        if (!this.engine || this.panel || this.state.defeated) return;
        const hit = this.engine.pick(event.clientX, event.clientY);
        if (hit.station) this.engine.goToStation(hit.station.id);
        else this.engine.moveTo(hit.x);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerleave', leave);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('click', click);
      this.unbindPointer = () => {
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('click', click);
      };
    });
  }
  /**
   * The station name card beside the pointer. Written straight to the DOM:
   * it moves with every pointermove, which must not run change detection.
   */
  private showTip(station: StationDef | null, clientX: number, clientY: number): void {
    const tip = this.stationTip?.nativeElement;
    if (!tip) return;
    if (!station || this.panel) {
      if (this.tipStation !== null) { tip.hidden = true; this.tipStation = null; }
      return;
    }
    if (this.tipStation !== station.id) {
      this.tipStation = station.id;
      const name = tip.querySelector('b'); const blurb = tip.querySelector('small');
      if (name) name.textContent = titleCase(station.label);
      if (blurb) blurb.textContent = station.blurb ?? '';
      tip.hidden = false;
    }
    const stage = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
    const x = Math.min(Math.max(clientX - stage.left + 16, 8), stage.width - 248);
    const y = Math.max(clientY - stage.top - 64, 72);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  /** Pop a satchel number when a pickup lands. Web Animations, so a burst of
   *  pickups restarts the pop instead of queueing class toggles. */
  private bump(selector: string): void {
    if (this.reducedMotion) return;
    const el = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
    el?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.45)', color: '#ffe08a', offset: .35 }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
  }
  /**
   * A monster's material drop reached the Keeper. The grant id is the engine's
   * drop id (session uuid : kill count : drop-table entry), so a pickup the
   * engine reports twice is still one grant. Refused → the drop stays on the
   * floor and the Keeper is told why.
   */
  private collectMaterial(dropId: string, material: string, quantity: number): boolean {
    if (!this.inventory.grantStack(`seamworks-loot:${dropId}`, material, quantity)) {
      this.message = this.inventory.canAcceptStackGrant(material)
        ? 'That pickup could not be saved. Walk over it again.'
        : 'Your satchel is full. Make room to pick that up.';
      return false;
    }
    const name = materialDisplay(material)?.name ?? titleCase(material.replace(/-/g, ' '));
    this.toastLoot(`+${quantity} ${name}`);
    this.bump(material === CINDER_ORE_ID ? '.ore-count' : material === EMBER_RESIDUE_ID ? '.ember-count' : '.satchel .clasp span');
    return true;
  }
  private toastLoot(text: string): void {
    const key = ++this.toastKey;
    this.lootToasts = [...this.lootToasts, { key, text }].slice(-3);
    setTimeout(() => { this.lootToasts = this.lootToasts.filter(toast => toast.key !== key); }, 1800);
  }
  ngOnDestroy(): void {
    this.room?.leave(); this.engine?.destroy(); if (this.timer) clearInterval(this.timer);
    this.atSub?.unsubscribe(); this.unbindPointer?.(); this.panelHost?.clear();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.tipTimer) clearTimeout(this.tipTimer);
  }

  // ── Places: stations as in-world panels ────────────────────────────────────

  private get reducedMotion(): boolean {
    return this.browser && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  /** `?at=<station id>`: stand at that station of the current town and open it. Unknown ids are ignored. */
  private applyAt(at: string | null): void {
    if (!this.browser) return;
    if (!at) { if (this.panel) this.closePanel(false); return; }
    if (this.panel?.stationId === at) return;
    if (!this.engine) { this.pendingAt = at; return; }
    if (!this.engine.inTown) return;
    const station = this.town.stations.find(row => row.id === at);
    if (!station) return;
    this.engine.placeAt(station.x);
    if (station.kind === 'panel' || station.kind === 'waystone') this.openStation(station);
  }
  private openStation(station: StationDef): void {
    if (!this.browser) return;
    if (station.kind === 'waystone') {
      this.showPanel({ kind: 'waystone', stationId: station.id, title: 'The Waystone', kicker: 'Travel' });
      return;
    }
    const entry = station.panel ? PANEL_REGISTRY[station.panel] : undefined;
    if (!entry) return;
    this.showPanel({ kind: 'page', stationId: station.id, title: entry.title, kicker: entry.kicker, route: entry.route });
    const seq = this.panelSeq;
    this.panelLoading = true;
    entry.load().then(type => {
      if (seq !== this.panelSeq || !this.panel) return;
      this.panelHost.clear();
      this.panelRef = this.panelHost.createComponent(type, { injector: this.panelInjector });
      this.panelLoading = false;
    }).catch(() => {
      if (seq !== this.panelSeq) return;
      this.panelLoading = false;
      this.panelError = 'This place could not be reached. Check your connection and try again.';
    });
  }
  private showPanel(place: OpenPlace): void {
    // A place opening while the last one folds away takes over the panel at once.
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = undefined; }
    this.closing = false;
    this.showTip(null, 0, 0);
    this.panelSeq++;
    this.panelHost.clear(); this.panelRef = null;
    this.panelError = ''; this.panelLoading = false;
    this.bagOpen = false; this.placesOpen = false;
    this.panel = place;
    this.engine?.setHover(null);
    this.engine?.setPaused(true);
    this.setAt(place.stationId);
    // Focus moves into the dialog once it is shown; the close button is always there.
    setTimeout(() => this.placePanel.nativeElement.querySelector<HTMLElement>('.place-close')?.focus());
  }
  /**
   * Close the place and hand focus back to the world. `syncUrl` is false when
   * the URL already changed (back/forward). The content folds away first
   * (PANEL_CLOSE_MS); with reduced motion it closes at once.
   */
  closePanel(syncUrl = true): void {
    if (!this.panel || this.closing) return;
    if (this.reducedMotion) { this.finishClose(syncUrl); return; }
    this.closing = true;
    this.closeTimer = setTimeout(() => this.finishClose(syncUrl), PANEL_CLOSE_MS);
  }
  private finishClose(syncUrl: boolean): void {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = undefined; }
    this.closing = false;
    if (!this.panel) return;
    this.panelSeq++;
    this.panelHost.clear(); this.panelRef = null;
    this.panel = null; this.panelLoading = false; this.panelError = '';
    this.engine?.setPaused(false);
    if (syncUrl) this.setAt(null);
    this.focusWorld();
  }
  /**
   * Put keyboard focus back on the game canvas.
   *
   * Not synchronously: until change detection drops `[attr.inert]` from the
   * viewport, the canvas sits in an inert subtree and `focus()` silently
   * refuses — focus fell to <body> and keyboard players had to click once
   * before A/D/E worked again. So focus after the next render, and check.
   */
  private focusWorld(): void {
    if (!this.browser) return;
    const attempt = (retry: boolean): void => {
      const canvas = this.boundCanvas?.isConnected ? this.boundCanvas : this.liveCanvas();
      if (!canvas || this.panel) return;
      if (canvas.closest('[inert]')) { if (retry) setTimeout(() => attempt(false), 50); return; }
      canvas.focus({ preventScroll: true });
    };
    afterNextRender(() => attempt(true), { injector: this.injector });
  }
  private setAt(at: string | null): void {
    if ((this.route.snapshot.queryParamMap.get('at') ?? null) === at) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { at }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  /** Keep Tab inside the open dialog. The rest of the stage is also `inert` while it is up. */
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.panel) return;
    const root = this.placePanel.nativeElement;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first.focus(); }
  }
  get waystone(): WaystoneRow[] {
    return REALM_TOWN_IDS.map(id => ({
      id, realm: TOWN_LABELS[id], town: TOWNS[id]?.name ?? 'Not yet charted',
      crest: this.art(REALM_ART[id].crest), available: !!TOWNS[id], current: this.town.id === id,
    }));
  }
  get realmLabel(): string { return TOWN_LABELS[this.town.realm]; }
  travel(id: RealmTownId): void {
    const town = TOWNS[id];
    if (!town || town.id === this.town.id) { this.closePanel(); return; }
    this.town = town;
    this.closePanel();
    this.engine?.setTown(town);
  }
  private placesCache: { area: string; rows: PlaceRow[] } | null = null;
  /** The current area's stations for the accessible Places list. Pure data, so it renders on the server too. */
  get places(): PlaceRow[] {
    const area = this.state.areaId ?? this.town.id;
    if (this.placesCache?.area !== area) {
      const stations = (areaOf(this.town, area) ?? this.town).stations;
      this.placesCache = { area, rows: stations.map(station => ({ id: station.id, name: titleCase(station.label), blurb: station.blurb ?? '' })) };
    }
    return this.placesCache.rows;
  }
  togglePlaces(): void {
    this.placesOpen = !this.placesOpen;
    if (this.placesOpen) setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#places-list button')?.focus());
  }
  /** Walk to the place and interact on arrival; with reduced motion, go there and open it at once. */
  choosePlace(place: PlaceRow): void {
    this.placesOpen = false;
    if (!this.engine?.goToStation(place.id, this.reducedMotion)) {
      this.message = this.state.paused ? 'Close the open place first.' : 'The Keeper cannot travel right now.';
    }
  }
  async joinRoom(name: string): Promise<void> {
    if (this.joining || !name.trim()) return;
    this.joining = true;
    try { await this.room?.join(name.trim()); } finally { this.joining = false; }
  }
  leaveRoom(): void { this.room?.leave(); }
  async sendChat(input: HTMLInputElement): Promise<void> {
    if (this.sending || !input.value.trim()) return;
    this.sending = true;
    const text = input.value.trim();
    try { if (await this.room?.chat(text)) { if (input.value.trim() === text) input.value = ''; } } finally { this.sending = false; }
  }
  art(id: string): string { return artFor(id)?.src ?? ''; }
  get ore(): number { return this.inventory.stackOf(CINDER_ORE_ID); }
  get ember(): number { return this.inventory.stackOf(EMBER_RESIDUE_ID); }
  get edge() {
    const edges = this.inventory.snapshot.items.filter(item => item.definitionId === 'basalt-edge' && !item.explorerId);
    return edges.find(item => item.equipped) ?? edges[0];
  }
  get equipped(): boolean { return !!this.edge?.equipped; }
  /** What the worn loadout buys in a fight. Strike drives damage, Ward max HP. */
  get combat(): KeeperCombatStats { return keeperCombatStats(this.inventory.snapshot.totals); }
  get remaining(): number { return Math.ceil(this.activity.recoveryRemainingMs(this.now) / 1000); }
  get objective(): string {
    if (this.state.area === 'Ember Quarry') return 'Hunt the Maws. Walk over drops to collect coins and ore. Return through the west portal.';
    if (this.restored) return 'Walk right to the open passage.';
    if (this.state?.enemyDefeated) return 'Reach the beacon and rekindle its light.';
    if (this.equipped) return 'Cross the platforms. Defeat the Rivet Maw.';
    if (this.edge) return 'Equip your Basalt Edge at the forge.';
    if (this.ore >= 6 && this.ember >= 1) return 'Walk right to the forge. Craft your first blade.';
    return 'Mine 6 Cinder Ore and find 1 Ember Residue.';
  }
  get actionLabel(): string {
    if (this.state?.nearbyKind === 'panel' || this.state?.nearbyKind === 'waystone') return `Enter ${titleCase(this.state.nearbyLabel ?? 'place')}`;
    switch (this.state?.nearby) {
      case 'ore': return this.remaining ? `Seam recovering (${this.remaining}s)` : 'Mine Cinder Ore';
      case 'forge': return this.equipped ? 'Blade equipped' : this.edge ? 'Equip Basalt Edge' : 'Forge Basalt Edge';
      case 'beacon': return this.restored ? 'Beacon restored' : 'Restore beacon';
      case 'passage': return this.state.area === 'Ember Quarry' ? 'Return to Seamworks' : 'Enter Ember Quarry';
      default: return 'Walk closer to a landmark';
    }
  }
  get actionDisabled(): boolean {
    return !this.state?.nearby || !!this.state.paused || !!this.state.defeated || (this.state.nearby === 'ore' && this.remaining > 0);
  }
  interact(): void { this.engine?.interact(); }
  returnToCamp(): void { this.message = ''; this.engine?.returnToCamp(); }
  restartHunt(): void { this.message = ''; this.engine?.restartHunt(); }
  retry(): void { this.returnToCamp(); }
  input(event: PointerEvent, input: EngineInput, down: boolean): void {
    event.preventDefault();
    if (down) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.engine?.setInput(input, down);
  }
  @HostListener('window:keydown', ['$event'])
  onBagKey(event: KeyboardEvent): void {
    if (!this.browser || event.repeat) return;
    // An open place owns the keyboard. Escape closes it unless the page inside
    // already used the key (its own dialog, a reveal) — window is the last stop.
    if (this.panel) {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); this.closePanel(); }
      return;
    }
    if (this.placesOpen && event.key === 'Escape') { event.preventDefault(); this.placesOpen = false; return; }
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;
    if (event.code === 'KeyI') { event.preventDefault(); this.toggleBag(); }
    else if (event.code === 'Escape' && this.bagOpen) { event.preventDefault(); this.closeBag(); }
  }
  openBag(): void { if (!this.bagOpen) this.toggleBag(); }
  closeBag(): void { this.bagOpen = false; }
  toggleBag(): void {
    this.bagOpen = !this.bagOpen;
    if (this.bagOpen && !this.pick) this.ensurePick();
  }
  choosePocket(pocket: BagPocket): void { this.pick = { kind: pocket.kind, ref: pocket.ref }; }
  chooseWell(well: BagWell): void { this.pick = { kind: 'slot', ref: well.id }; }
  pickedPocket(pocket: BagPocket): boolean { return this.pick?.kind === pocket.kind && this.pick.ref === pocket.ref; }
  pickedWell(id: SlotId): boolean { return this.pick?.kind === 'slot' && this.pick.ref === id; }
  get pocketFill(): number {
    const used = this.inventory.snapshot.usedRows;
    return used <= 0 ? 0 : Math.min(100, (used / this.bagCap) * 100);
  }
  get wells(): BagWell[] {
    const snap = this.inventory.snapshot;
    const charms = snap.items.some(item => item.type === 'charm' && !item.explorerId);
    const slots = charms ? [...BELT, ...CHARM_SLOT_IDS] : BELT;
    return slots.map(id => {
      const worn = snap.equipped[id];
      const item = worn && !worn.explorerId ? worn : undefined;
      const name = SLOT_BY_ID.get(id)?.name ?? id;
      return {
        id, name,
        art: item ? (itemArt(item)?.src ?? '') : '',
        mark: monogram(item?.name ?? name),
        label: item?.name ?? 'Empty',
        filled: !!item,
      };
    });
  }
  get pockets(): BagPocket[] {
    const snap = this.inventory.snapshot;
    const pin = [CINDER_ORE_ID, EMBER_RESIDUE_ID];
    const stacks = [...snap.stacks].sort((a, b) => {
      const ai = pin.indexOf(a.stackKey);
      const bi = pin.indexOf(b.stackKey);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return (materialDisplay(a.stackKey)?.name ?? a.stackKey).localeCompare(materialDisplay(b.stackKey)?.name ?? b.stackKey);
    });
    const materials: BagPocket[] = stacks.map(stack => {
      const display = materialDisplay(stack.stackKey);
      const name = display?.name ?? stack.stackKey;
      return { key: `stack:${stack.stackKey}`, kind: 'stack', ref: stack.stackKey, name, art: display?.art ?? '', qty: stack.quantity, pip: '#df9357', mark: monogram(name) };
    });
    const gear: BagPocket[] = snap.bag.map(item => ({
      key: `item:${item.id}`, kind: 'item', ref: item.id, name: item.name,
      art: itemArt(item)?.src ?? '', qty: 1, pip: rarityColor(item.rarity), mark: monogram(item.name),
    }));
    return [...materials, ...gear];
  }
  get slip(): BagSlip | null {
    const pick = this.pick;
    if (!pick) return null;
    if (pick.kind === 'stack') return this.stackSlip(pick.ref);
    if (pick.kind === 'slot') {
      const item = this.inventory.snapshot.equipped[pick.ref as SlotId];
      if (!item || item.explorerId) return this.emptyWell(pick.ref as SlotId);
      return this.itemSlip(item, true);
    }
    const item = this.inventory.snapshot.items.find(row => row.id === pick.ref && !row.explorerId);
    return item ? this.itemSlip(item, item.equipped) : null;
  }
  wear(): void {
    const item = this.selectedGear();
    if (!item || item.equipped) return;
    const ok = isBasaltEdge(item) ? this.inventory.equip(item.id, 'weapon') : this.inventory.equip(item.id);
    this.message = ok ? `${item.name} is worn.` : `${item.name} could not be worn. Try again.`;
    if (!ok) return;
    this.sync();
    const slot = this.inventory.snapshot.items.find(row => row.id === item.id)?.slot;
    if (slot) this.pick = { kind: 'slot', ref: slot };
  }
  stow(): void {
    const item = this.selectedGear();
    if (!item) return;
    const ok = this.inventory.unequip(item.id);
    this.message = ok ? `${item.name} is back in the satchel.` : `${item.name} could not be stowed. Try again.`;
    if (!ok) return;
    this.sync();
    this.pick = { kind: 'item', ref: item.id };
  }
  private ensurePick(): void {
    const first = this.pockets[0];
    this.pick = first ? { kind: first.kind, ref: first.ref } : { kind: 'slot', ref: 'weapon' };
  }
  private selectedGear(): GameItem | null {
    const pick = this.pick;
    if (!pick || pick.kind === 'stack') return null;
    if (pick.kind === 'slot') {
      const worn = this.inventory.snapshot.equipped[pick.ref as SlotId];
      return worn && !worn.explorerId ? worn : null;
    }
    return this.inventory.snapshot.items.find(row => row.id === pick.ref && !row.explorerId) ?? null;
  }
  private stackSlip(stackKey: string): BagSlip | null {
    const stack = this.inventory.snapshot.stacks.find(row => row.stackKey === stackKey);
    if (!stack) return null;
    const display = materialDisplay(stackKey);
    const name = display?.name ?? stackKey;
    return {
      name, art: display?.art ?? '', mark: monogram(name), kicker: 'Material',
      note: this.stackNote(stackKey, stack.quantity), stats: [`${stack.quantity} held`],
      canWear: false, canStow: false, compare: [], compareLabel: '',
    };
  }
  private stackNote(stackKey: string, qty: number): string {
    if (stackKey === CINDER_ORE_ID) {
      if (qty >= 6 && this.ember >= 1) return 'The forge has enough ore. One ember residue completes the Basalt Edge.';
      if (qty >= 6) return 'Six ore are ready. The forge still wants one ember residue.';
      const more = 6 - qty;
      return `${more} more ${more === 1 ? 'piece' : 'pieces'}, and one ember residue, forge the Basalt Edge.`;
    }
    if (stackKey === EMBER_RESIDUE_ID) {
      return this.ore >= 6 ? 'The forge can drink this with the ore you carry.' : 'The forge takes one of these with six cinder ore.';
    }
    return 'Kept in the satchel. It stays on this device.';
  }
  private emptyWell(slot: SlotId): BagSlip {
    const name = SLOT_BY_ID.get(slot)?.name ?? 'Place';
    return { name, art: '', mark: monogram(name), kicker: 'Worn', note: 'Nothing rests in this place.', stats: [], canWear: false, canStow: false, compare: [], compareLabel: '' };
  }
  private itemSlip(item: GameItem, worn: boolean): BagSlip {
    const def = definitionFor(item);
    const stats = ITEM_STAT_KEYS.filter(key => (item.stats[key] ?? 0) !== 0).map(key => formatItemMod(key, item.stats[key]!));
    const level = item.upgradeLevel ?? 0;
    return {
      name: level > 0 ? `${item.name} +${level}` : item.name,
      art: itemArt(item)?.src ?? '',
      mark: monogram(item.name),
      kicker: worn ? 'Worn' : rarityLabel(item.rarity),
      note: item.lore || def?.lore || (worn ? 'Worn by the Keeper.' : 'In the satchel, ready to be worn.'),
      stats,
      canWear: !worn && EQUIPMENT_SLOTS.some(slot => itemFitsSlot(slot.id, item)),
      canStow: worn,
      ...this.slipCompare(item, worn),
    };
  }
  /**
   * The slot `wear()` would put this in — the same pick `InventoryService.equip`
   * makes unaimed (a free fitting place first, else the first fitting one), and
   * the weapon slot for the Edge — and the delta against what is there now.
   */
  private slipCompare(item: GameItem, worn: boolean): Pick<BagSlip, 'compare' | 'compareLabel'> {
    if (worn) return { compare: [], compareLabel: '' };
    const equipped = this.inventory.snapshot.equipped;
    const fits = (s: SlotId) => itemFitsSlot(s, item);
    const target: SlotId | undefined = isBasaltEdge(item) ? 'weapon'
      : SLOT_IDS.find(s => fits(s) && !equipped[s]) ?? SLOT_IDS.find(fits);
    if (!target || !fits(target)) return { compare: [], compareLabel: '' };
    const current = equipped[target];
    const there = current && !current.explorerId ? current : undefined;
    const place = SLOT_BY_ID.get(target)?.name ?? target;
    return {
      compare: compareStats(item.stats, there?.stats, { includeUnchanged: true }),
      compareLabel: there ? `Against ${there.name}` : `Against an empty ${place}`,
    };
  }
  private sync(): void {
    this.engine?.setProgress({ equipped: this.equipped, restored: this.restored });
    this.pushStats();
  }
  /** Hand the engine the loadout's combat numbers when they change. */
  private pushStats(): void {
    if (!this.engine) return;
    this.pushLoadout();
    this.pushSatchelTarget();
    const stats = this.combat;
    const key = `${stats.damage}:${stats.maxHp}`;
    if (key === this.statsKey) return;
    this.statsKey = key;
    this.pushed = stats;
    this.engine.setStats(stats);
  }
  /** The engine's still-landing methods, present or not. Never assume they exist. */
  private get engineExtras(): PendingEngineApi {
    return (this.engine ?? {}) as unknown as PendingEngineApi;
  }
  /**
   * What the Keeper wears, for the engine to draw: the weapon and off-hand art
   * (the same `itemArt()` the satchel uses) and the highest worn rarity for the
   * aura. Sent only when it changes, and only once `engine.setLoadout` exists.
   */
  private pushLoadout(): void {
    const setLoadout = this.engineExtras.setLoadout;
    if (typeof setLoadout !== 'function') return;
    const loadout = this.loadout();
    const key = `${loadout.weapon?.art}:${loadout.weapon?.rarity}|${loadout.offhand?.art}:${loadout.offhand?.rarity}|${loadout.auraRarity}`;
    if (key === this.loadoutKey) return;
    this.loadoutKey = key;
    setLoadout.call(this.engine, loadout);
  }
  private loadout(): KeeperLoadout {
    const equipped = this.inventory.snapshot.equipped;
    const worn = (slot: SlotId): GameItem | undefined => {
      const item = equipped[slot];
      return item && !item.explorerId ? item : undefined;
    };
    const piece = (item: GameItem | undefined): LoadoutPiece | undefined => {
      const art = item ? itemArt(item)?.src : undefined;
      return item && art ? { art, rarity: item.rarity } : undefined;
    };
    let aura: ItemRarity | undefined;
    for (const slot of SLOT_IDS) {
      const item = worn(slot);
      if (item && (!aura || RUNE_TIER_ORDER.indexOf(item.rarity) > RUNE_TIER_ORDER.indexOf(aura))) aura = item.rarity;
    }
    return { weapon: piece(worn('weapon')), offhand: piece(worn('off-hand')), auraRarity: aura };
  }
  /**
   * Where pickups should fly: the satchel's coin row, in canvas CSS px (the
   * canvas element's own box, not world units). Re-sent when the HUD moves
   * (resize, the mobile layout), and only once the engine accepts a target.
   */
  private pushSatchelTarget(): void {
    const setTarget = this.engineExtras.setSatchelTarget;
    if (typeof setTarget !== 'function' || !this.boundCanvas) return;
    const target = this.host.nativeElement.querySelector('.satchel .coin-count') as HTMLElement | null;
    if (!target) return;
    const canvasBox = this.boundCanvas.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const point = { x: Math.round(box.left + box.width / 2 - canvasBox.left), y: Math.round(box.top + box.height / 2 - canvasBox.top) };
    const key = `${point.x},${point.y}`;
    if (key === this.satchelKey) return;
    this.satchelKey = key;
    setTarget.call(this.engine, point);
  }
  private act(target: InteractionTarget): void {
    if (!this.browser || this.state?.paused || this.state?.defeated) return;
    if (target === 'ore') this.mine();
    if (target === 'forge') this.forge();
    if (target === 'beacon') this.restore();
    if (target === 'passage') this.message = '';
    this.sync();
  }
  private mine(): void {
    if (this.remaining > 0) return;
    if (!this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID)) {
      this.message = 'Mining could not be saved. Check browser storage and try again.'; return;
    }
    this.pendingMine ??= `world-mine:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const result = this.activity.resolveMine({ mutationId: this.pendingMine, locationId: BASALT_SEAMWORKS_ID, oreId: CINDER_ORE_ID });
    this.now = Date.now();
    if (!result.ok) {
      this.message = result.code === 'capacity' ? 'Your bag is full. Make room in your inventory before mining.' : result.code === 'persist' ? 'This strike could not be saved. Try again to finish it safely.' : 'The seam is recovering. Wait a moment before striking again.';
      if (result.code !== 'persist') this.pendingMine = null;
      return;
    }
    this.pendingMine = null;
    this.message = 'Cinder Ore gathered. Keep mining for an ember, then walk right to the forge.';
    // Scoped tutorial supply, separate from the global 800-action discovery guarantee.
    // Reuse the storyboard's claim ID so switching prototypes cannot duplicate it.
    if (this.activity.snapshot.miningAccepted >= 8 && !this.edge && this.ember < 1) {
      const granted = this.inventory.grantStack(TUTORIAL_EMBER_ID, EMBER_RESIDUE_ID, 1);
      this.message = !granted ? 'Ore saved. The first-craft tutorial ember could not be stored; make room and mine again.' : this.ember > 0 ? 'First-craft tutorial ember found. Bring 6 Cinder Ore and 1 Ember Residue to the forge.' : 'The tutorial ember was already claimed. Retrieve it from your bank, or keep mining for another discovery.';
    } else if (this.ember >= 1 && this.ore >= 6) this.message = 'The forge has everything it needs. Walk right to craft your blade.';
  }
  private forge(): void {
    if (this.edge) {
      this.message = this.equipped ? 'Your Basalt Edge is equipped. The Rivet Maw waits beyond the platforms.' : this.inventory.equip(this.edge.id, 'weapon') ? 'Basalt Edge equipped. Press J to attack and K to dodge.' : 'Equipping could not be saved. Try again.';
      return;
    }
    const result = this.inventory.craftBasaltEdge(CRAFT_ID);
    this.message = result.ok ? 'Your Basalt Edge is ready. Interact once more to equip it.' : result.code === 'persist' ? 'The craft could not be saved. Try again to finish safely.' : result.code === 'capacity' ? 'Make room in your bag for the blade.' : 'You need 6 Cinder Ore and 1 Ember Residue. A first-craft tutorial ember is available after 8 accepted strikes.';
    if (result.ok) this.activity.markCraftedBasaltEdge();
  }
  private restore(): void {
    if (this.restored) { this.message = 'The beacon burns. Follow the light to the right-hand passage.'; return; }
    if (!this.state?.enemyDefeated) { this.message = 'The Rivet Maw still guards this crossing. Defeat it before lighting the beacon.'; return; }
    const saved = { restored: true, era: INVENTORY_ERA, resetAt: this.store.readRaw(RESET_STAMP_KEY) };
    this.store.write(SAVE_KEY, saved);
    if (this.store.readRaw(SAVE_KEY) !== JSON.stringify(saved)) { this.message = 'The beacon could not be saved. Try again.'; return; }
    this.restored = true;
    this.message = 'Warm light returns to the Seamworks. The passage is open.';
  }
}
