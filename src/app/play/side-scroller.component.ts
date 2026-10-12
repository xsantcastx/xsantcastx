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
import { HOME_FORGE, IN_WORLD_FOCUS, IN_WORLD_PANEL } from '../shared/in-world-panel';
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
import { HomesteadService } from './homestead/homestead.service';
import { HomesteadColumnComponent } from './homestead/homestead-column.component';
import { HomeForgeService } from './homestead/home-forge.service';
import { homeStationOf } from './world/homestead';
import { SeamworksEngine, EngineInput, EngineState, HeldItem, InteractionTarget, KeeperLoadout, PlaceableId, PlaceEvent, ToolTiers, UseEvent, WorldActionEvent } from './engine/engine';
import { ChestRow, DelveChestService } from '../shared/delve/delve-chest.service';
import { PLACEABLES } from './engine/terrain';
import { miningLevelView } from '../shared/activity/mining-level';
import { toolTiers } from '../shared/skills/tools';
import { SkillActionService } from '../shared/skills/skill-actions.service';
import { skillForDiscipline } from '../shared/skills/skill.model';
import { DelveSaveService } from '../shared/delve/delve-save.service';
import { DelveLoreService } from '../shared/delve/delve-lore.service';
import { INSCRIPTION_XP, inscriptionById } from '../shared/delve/delve-lore.model';
import type { DiscoverEvent } from './engine/engine';

/** Finds a player is paid once, ever (delve-save `claimed`). */
const ONCE_PER_PLAYER = new Set(['godforge-fragment', 'kaels-hammer']);

/** Where Delve swings are recorded in the activity ledger. */
const EMBER_DELVE_LOCATION = 'infernal/ember-delve';
import type { InventorySnapshot } from '../shared/rpg/inventory.service';

/**
 * Tool tiers for the delve until real tool items exist.
 * The floor under toolTiers(): crafted tools raise it (see pushStats).
 */
export function provisionalToolTiers(snapshot: Pick<InventorySnapshot, 'equipped'>): ToolTiers {
  const held = [snapshot.equipped['weapon'], snapshot.equipped['off-hand']].filter(item => item && !item.explorerId);
  const staff = held.some(item => /staff|wand|rod|scepter|sceptre/i.test(`${item!.definitionId} ${item!.name}`));
  const weapon = snapshot.equipped['weapon'];
  return { pickaxe: 1, axe: 1, sickle: 1, blade: weapon && !weapon.explorerId ? 1 : 0, staff: staff ? 1 : 0 };
}

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

/** What the in-world panel is showing: a hosted page, the waystone's travel list, or a chest placed in the Delve. */
interface OpenPlace {
  kind: 'page' | 'waystone' | 'chest'; stationId: string; title: string; kicker: string; route?: string;
  chest?: { areaId: string; index: number };
  /** A place in the player's own Delve (a chest, a camp): no ?at= deep link. */
  own?: true;
}
/** The open chest: what is in it and what the satchel could put in. Rebuilt after every move. */
interface ChestView { rows: ChestRow[]; satchel: ChestRow[]; slots: number; note: string }
interface PlaceRow { id: string; name: string; blurb: string }
interface WaystoneRow { id: RealmTownId; realm: string; town: string; crest: string; available: boolean; current: boolean }

/** How long the place's content takes to fold away. Kept in step with `place-out` in the stylesheet. */
const PANEL_CLOSE_MS = 160;
/** How long a touched station stays highlighted, with its name card up. */
const TOUCH_TIP_MS = 1400;

interface LootToast { key: number; text: string }
/** One slot of the Delve hotbar: a placeable and how many the satchel holds. */
interface HotbarSlot { id: PlaceableId; name: string; art: string; count: number; key: string }

/** How long a press on the world must be held to place there. */
const LONG_PRESS_MS = 450;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function titleCase(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

@Component({
  selector: 'app-side-scroller', standalone: true, imports: [RouterLink, KeeperStatSheetComponent, HomesteadColumnComponent],
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
  /** A camp's bench: the same Crafting Bench, opened on what can be made now. */
  private readonly campInjector = Injector.create({
    providers: [{ provide: IN_WORLD_PANEL, useValue: true }, { provide: IN_WORLD_FOCUS, useValue: 'ready' }], parent: this.injector,
  });
  /** Your Anvil / Your Enchanting Circle in the Homestead: the same benches, with the station's tier (HOME_FORGE). */
  private readonly homeForge = inject(HomeForgeService);
  private readonly homeInjector = Injector.create({
    providers: [{ provide: IN_WORLD_PANEL, useValue: true }, { provide: HOME_FORGE, useValue: this.homeForge.context }], parent: this.injector,
  });
  /** True while the Keeper stands at the Delve shaft and has a camp below. */
  campReady = false;
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
  private tipStation: string | null = null;
  private tipTimer?: ReturnType<typeof setTimeout>;
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly inventory = inject(InventoryService);
  /** The Homestead's canvas view and its data (homestead/homestead.service.ts). */
  private readonly homestead = inject(HomesteadService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly skillActions = inject(SkillActionService);
  private readonly store = inject(GameStateGateway);
  /** The player's own Delve (seed + dug cells) and the inscriptions they have read. */
  private readonly delve = inject(DelveSaveService);
  private readonly delveLore = inject(DelveLoreService);
  private readonly chests = inject(DelveChestService);
  /** The chest panel's contents while one is open. */
  chestView: ChestView | null = null;
  private delveSub?: Subscription;
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
  private toolKey = '';
  /** The Delve hotbar, rebuilt on the HUD tick when a count changes. */
  hotbar: HotbarSlot[] = [];
  private hotbarKey = '';
  /** The hotbar's choice: what B / a long-press places. */
  placing: PlaceableId | null = null;

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
    this.homestead.start();
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
      // Cloud save replaced the Delve (another device's dig): rebuild it from the merged save.
      this.delveSub = this.delve.reloaded$.subscribe(() => this.engine?.setDelve(this.delve));
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
      // Pickups fly to the satchel's coin count, wherever the HUD layout put it. Read per pickup.
      satchelTarget: () => this.satchelPoint(),
      onInteract: (target: InteractionTarget) => this.zone.run(() => this.act(target)),
      onStation: station => this.zone.run(() => this.openStation(station)),
      onLoot: loot => loot.ore === 0 || this.zone.run(() => this.collectMaterial(loot.id, loot.material ?? CINDER_ORE_ID, loot.ore)),
      onWorldAction: event => this.zone.run(() => this.worldAction(event)),
      onDiscover: event => this.zone.run(() => this.discover(event)),
      onPlace: event => this.zone.run(() => this.placeFromSatchel(event)),
      onTakeBack: event => this.zone.run(() => this.takeToSatchel(event)),
      onUse: event => this.zone.run(() => this.useCell(event)),
      // Each player digs their own Delve: seed and dug cells from the save.
      delve: this.delve,
      onState: (state: EngineState) => this.zone.run(() => {
        if (state.message !== this.state.message) this.message = '';
        if ((state.coins ?? 0) > (this.state.coins ?? 0)) this.bump('.coin-count');
        if (state.delve && !this.state.delve) this.refundOrphanChests();
        // At the shaft: is there a camp below to descend to? Asked once per arrival, not per frame.
        if (state.nearby === 'delve' && this.state.nearby !== 'delve') this.campReady = !!this.engine?.hasDelveCamp();
        else if (state.nearby !== 'delve') this.campReady = false;
        this.state = state;
        this.room?.update(state.x, state.y, state.area || 'Basalt Seamworks', state.facing === -1 ? -1 : 1, state.animation ?? 'idle');
      }),
    });
    this.engine.setHomesteadView(this.homestead.scene);
    this.statsKey = '';
    this.loadoutKey = '';
    this.toolKey = '';
    this.engine.setPlaceable(this.placing);
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
        this.engine?.setHover(null); this.engine?.clearPointer(); canvas.style.cursor = ''; this.showTip(null, 0, 0);
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
      // Delves: hold a press on a cell (or right-click it) to place the hotbar's choice there.
      let pressTimer: ReturnType<typeof setTimeout> | undefined;
      let pressAt = { x: 0, y: 0 };
      let pressed = false;
      const cancelPress = (): void => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; } };
      const pressStart = (event: PointerEvent): void => {
        cancelPress();
        pressed = false;
        if (!this.engine || this.panel || !this.state.delve || event.button > 0) return;
        pressAt = { x: event.clientX, y: event.clientY };
        pressTimer = setTimeout(() => {
          pressTimer = undefined;
          if (!this.engine || this.panel) return;
          pressed = true;
          this.zone.run(() => this.engine?.placeAtClient(pressAt.x, pressAt.y));
        }, LONG_PRESS_MS);
      };
      const pressMove = (event: PointerEvent): void => {
        if (pressTimer && Math.hypot(event.clientX - pressAt.x, event.clientY - pressAt.y) > 12) cancelPress();
      };
      const context = (event: MouseEvent): void => {
        if (!this.engine || this.panel || !this.state.delve) return;
        event.preventDefault();
        this.zone.run(() => this.engine?.placeAtClient(event.clientX, event.clientY));
      };
      const click = (event: MouseEvent): void => {
        if (!this.engine || this.panel || this.state.defeated) return;
        // The click that ends a long-press placed something; it does not also swing.
        if (pressed) { pressed = false; return; }
        if (this.engine.strikeAt(event.clientX, event.clientY)) return;
        const hit = this.engine.pick(event.clientX, event.clientY);
        // The Homestead Forge strikes where it is clicked, without walking there.
        if (hit.station && this.homestead.scene.interact(this.state.areaId ?? '', hit.station.id)) return;
        if (hit.station) this.engine.goToStation(hit.station.id);
        else this.engine.moveTo(hit.x);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerleave', leave);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('click', click);
      canvas.addEventListener('pointerdown', pressStart);
      canvas.addEventListener('pointermove', pressMove);
      canvas.addEventListener('pointerup', cancelPress);
      canvas.addEventListener('pointercancel', cancelPress);
      canvas.addEventListener('pointerleave', cancelPress);
      canvas.addEventListener('contextmenu', context);
      this.unbindPointer = () => {
        cancelPress();
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('pointerdown', pressStart);
        canvas.removeEventListener('pointermove', pressMove);
        canvas.removeEventListener('pointerup', cancelPress);
        canvas.removeEventListener('pointercancel', cancelPress);
        canvas.removeEventListener('pointerleave', cancelPress);
        canvas.removeEventListener('contextmenu', context);
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
    if (this.browser) this.homestead.stop();
    this.atSub?.unsubscribe(); this.delveSub?.unsubscribe(); this.unbindPointer?.(); this.panelHost?.clear();
    if (this.browser) this.delve.flush();
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
    const home = homeStationOf(station.id);
    if (home) {
      // No "Open full page": the routed bench would drop the home tier.
      this.showPanel({ kind: 'page', stationId: station.id, title: this.homeForge.name(home), kicker: this.homeForge.kicker() });
      this.loadPanel(entry, this.homeInjector);
      return;
    }
    this.showPanel({ kind: 'page', stationId: station.id, title: entry.title, kicker: entry.kicker, route: entry.route });
    this.loadPanel(entry, this.panelInjector);
  }
  /** Build a hosted page into the open panel (a slow import never lands in a newer or closed one). */
  private loadPanel(entry: (typeof PANEL_REGISTRY)[keyof typeof PANEL_REGISTRY], injector: Injector): void {
    const seq = this.panelSeq;
    this.panelLoading = true;
    entry.load().then(type => {
      if (seq !== this.panelSeq || !this.panel) return;
      this.panelHost.clear();
      this.panelRef = this.panelHost.createComponent(type, { injector });
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
    // A chest or a camp has no deep link: it is a cell in this player's own Delve.
    if (!place.own) this.setAt(place.stationId);
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
    this.chestView = null;
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
  /** The header title: the area the Keeper stands in ("Ember Delve"), not only its town. */
  get areaTitle(): string { return this.state.area || this.town.name; }
  /**
   * The creature the enemy bar is measuring. The engine reports only its HP, so
   * name it from the area's data: the one kind that lives here, or — in a mixed
   * hunt — the kind whose spawn points sit nearest the Keeper.
   */
  get enemyName(): string {
    // The engine names the creature it measured; the area data is the fallback for an older state.
    if (this.state.enemyName) return this.state.enemyName;
    const area = areaOf(this.town, this.state.areaId ?? this.town.id) ?? this.town;
    const monsters = area.monsters;
    if (!monsters.length) return 'Enemy';
    if (monsters.every(monster => monster.name === monsters[0].name)) return monsters[0].name;
    const reach = (spawns: readonly number[]) => Math.min(...spawns.map(x => Math.abs(x - this.state.x)));
    return monsters.reduce((best, monster) => reach(monster.spawnXs) < reach(best.spawnXs) ? monster : best).name;
  }
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
    if (this.state.areaId === 'homestead') return 'Click the Forge to strike it. Buy buildings in the column. Walk past one to collect.';
    if (this.state.delve) return 'Dig down (hold S + J, or tap rock). Dug dirt and stone become blocks: pick one below and press B to place it.';
    if (this.state.area === 'Ember Quarry') return 'Hunt the Maws. Walk over drops to collect coins and ore. Return through the west portal.';
    if (this.restored) return 'Walk right to the open passage.';
    if (this.state?.enemyDefeated) return 'Reach the beacon and rekindle its light.';
    if (this.equipped) return 'Cross the platforms. Defeat the Rivet Maw.';
    if (this.edge) return 'Equip your Basalt Edge at the forge.';
    if (this.ore >= 6 && this.ember >= 1) return 'Walk right to the forge. Craft your first blade.';
    return 'Mine 6 Cinder Ore and find 1 Ember Residue.';
  }
  get actionLabel(): string {
    if (this.state?.nearby === 'hs-forge') return 'Strike the Forge';
    if (this.state?.nearbyKind === 'panel' || this.state?.nearbyKind === 'waystone') return `Enter ${titleCase(this.state.nearbyLabel ?? 'place')}`;
    switch (this.state?.nearby) {
      case 'ore': return this.remaining ? `Seam recovering (${this.remaining}s)` : 'Mine Cinder Ore';
      case 'forge': return this.equipped ? 'Blade equipped' : this.edge ? 'Equip Basalt Edge' : 'Forge Basalt Edge';
      case 'beacon': return this.restored ? 'Beacon restored' : 'Restore beacon';
      case 'inscription': return 'Read the inscription';
      case 'chest': return 'Open the chest';
      case 'camp': return 'Craft at your camp';
      case 'delve': return this.campReady ? 'Enter the Delve at the top' : 'Enter the Ember Delve';
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
    else if (event.code === 'KeyC' && this.campReady) { event.preventDefault(); this.descendToCamp(); }
    else if (this.state.delve && /^Digit[1-9]$/.test(event.code)) {
      const slot = this.hotbar[Number(event.code.slice(5)) - 1];
      if (slot) { event.preventDefault(); this.choosePlaceable(slot.id); }
    }
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
    this.refreshHotbar();
    // Crafted tools (skills/tools.ts) raise the floor; the provisional tier-I kit
    // keeps a fresh save able to dig before it owns a pickaxe. Lantern radius
    // stays on the engine default: toolTiers() measures it in tiles, the engine
    // in its own units — reconcile before passing it (see world-plan watch list).
    const floor = provisionalToolTiers(this.inventory.snapshot);
    const crafted = toolTiers(this.inventory.snapshot, this.activity.snapshot.progress);
    const tools = {
      pickaxe: Math.max(floor.pickaxe ?? 0, crafted.pickaxe),
      axe: Math.max(floor.axe ?? 0, crafted.axe),
      sickle: Math.max(floor.sickle ?? 0, crafted.sickle),
      blade: Math.max(floor.blade ?? 0, crafted.blade),
      staff: Math.max(floor.staff ?? 0, crafted.staff),
    };
    const mining = miningLevelView(this.activity.snapshot.progress.xpByDiscipline.mining ?? 0).level;
    const toolKey = `${JSON.stringify(tools)}:${mining}`;
    if (toolKey !== this.toolKey) { this.toolKey = toolKey; this.engine.setTools({ ...tools, levels: { mining } }); }
    const stats = this.combat;
    const key = `${stats.damage}:${stats.maxHp}`;
    if (key === this.statsKey) return;
    this.statsKey = key;
    this.pushed = stats;
    this.engine.setStats(stats);
  }
  /**
   * What the Keeper wears, for the engine to draw: the weapon and off-hand art
   * (the same `itemArt()` the satchel uses) and the highest worn rarity for the
   * aura. Visual only. Sent when it changes (checked on the HUD tick).
   */
  private pushLoadout(): void {
    if (!this.engine) return;
    const loadout = this.loadout();
    const key = `${loadout.weapon?.art}:${loadout.weapon?.rarity}|${loadout.offhand?.art}:${loadout.offhand?.rarity}|${loadout.auraRarity}`;
    if (key === this.loadoutKey) return;
    this.loadoutKey = key;
    this.engine.setLoadout(loadout);
  }
  private loadout(): KeeperLoadout {
    const equipped = this.inventory.snapshot.equipped;
    const worn = (slot: SlotId): GameItem | undefined => {
      const item = equipped[slot];
      return item && !item.explorerId ? item : undefined;
    };
    const held = (item: GameItem | undefined): HeldItem | null => {
      const art = item ? itemArt(item)?.src : undefined;
      return item && art ? { art, rarity: item.rarity } : null;
    };
    let aura: ItemRarity | null = null;
    for (const slot of SLOT_IDS) {
      const item = worn(slot);
      if (item && (!aura || RUNE_TIER_ORDER.indexOf(item.rarity) > RUNE_TIER_ORDER.indexOf(aura))) aura = item.rarity;
    }
    return { weapon: held(worn('weapon')), offhand: held(worn('off-hand')), auraRarity: aura };
  }
  /** The satchel's coin count, in viewport px, for the engine's pickup flights. Null → the engine's default corner. */
  private satchelPoint(): { x: number; y: number } | null {
    const target = this.host.nativeElement.querySelector('.satchel .coin-count') as HTMLElement | null;
    const box = target?.getBoundingClientRect();
    return box && (box.width || box.height) ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
  }
  // ── Building in the Delve ────────────────────────────────────────────────

  /** Rebuild the hotbar when a count changed. Cheap: one stack read per placeable. */
  private refreshHotbar(): void {
    const counts = PLACEABLES.map(def => this.inventory.stackOf(def.id));
    const key = counts.join(',');
    if (key === this.hotbarKey && this.hotbar.length) return;
    this.hotbarKey = key;
    this.hotbar = PLACEABLES.map((def, i) => ({
      id: def.id, name: def.label, art: materialDisplay(def.id)?.art ?? '', count: counts[i], key: String(i + 1),
    }));
    // Nothing chosen yet: the first thing the satchel holds.
    if (!this.placing) {
      const first = this.hotbar.find(slot => slot.count > 0);
      if (first) this.choosePlaceable(first.id, true);
    }
  }
  /** The chosen slot, for the hint line. */
  get placingSlot(): HotbarSlot | undefined { return this.hotbar.find(slot => slot.id === this.placing); }
  choosePlaceable(id: PlaceableId, quiet = false): void {
    this.placing = id;
    this.engine?.setPlaceable(id);
    if (!quiet) {
      const slot = this.placingSlot;
      this.message = slot ? `${slot.name} ready (${slot.count}). Press B, or hold a tap where it should go.` : '';
    }
  }
  /** The hotbar's Place button: same as B. */
  placeHere(): void { this.engine?.place(); }
  /**
   * The engine is about to place one thing: take it from the satchel first.
   * One consume op keyed by the placement's mutation id, so a replay never
   * takes two. Refused (none left, a failed save) → nothing is placed.
   */
  private placeFromSatchel(event: PlaceEvent): boolean {
    if (!this.browser) return false;
    const name = materialDisplay(event.item)?.name ?? event.item;
    if (this.inventory.stackOf(event.item) < 1) {
      this.message = `You have no ${name.toLowerCase()} left. Dig or craft more.`;
      return false;
    }
    const result = this.inventory.consumeStacks(event.mutationId, [{ id: event.item, count: 1 }]);
    if (!result.ok) {
      this.message = 'That could not be saved. Try again.';
      return false;
    }
    this.refreshHotbar();
    return true;
  }
  /** A placed thing comes back: one grant keyed by the take's mutation id. */
  private takeToSatchel(event: PlaceEvent): boolean {
    if (!this.browser) return false;
    if (event.item === 'chest' && !this.chests.isEmpty(event.areaId, event.index)) {
      this.message = 'Empty the chest first: open it (E) and take everything out.';
      return false;
    }
    if (!this.inventory.grantStack(event.mutationId, event.item, 1)) {
      this.message = 'Your satchel is full. Make room to take it back.';
      return false;
    }
    if (event.item === 'chest') this.chests.forget(event.areaId, event.index);
    this.refreshHotbar();
    return true;
  }
  /** E beside (or a tap on) a placed chest or camp. */
  private useCell(event: UseEvent): void {
    if (!this.browser) return;
    if (event.kind === 'chest') {
      this.showPanel({ kind: 'chest', stationId: 'chest', title: 'Chest', kicker: 'Your Delve', chest: { areaId: event.areaId, index: event.index }, own: true });
      this.refreshChest('Put things in to keep them here. Take them out any time.');
    } else if (event.kind === 'camp') {
      // The Crafting Bench, opened on "Ready now": what you can make here with what you carry.
      const entry = PANEL_REGISTRY.crafting;
      this.showPanel({ kind: 'page', stationId: 'camp', title: 'Your camp', kicker: 'Craft what you can now', own: true });
      this.loadPanel(entry, this.campInjector);
    }
  }
  /** "Descend to your camp" at the Delve shaft. */
  descendToCamp(): void {
    if (!this.engine?.descendToCamp()) this.campReady = !!this.engine?.hasDelveCamp();
    else this.campReady = false;
  }
  /** Rebuild the open chest's two lists. */
  private refreshChest(note: string): void {
    const at = this.panel?.chest;
    if (!at) { this.chestView = null; return; }
    const satchel = this.inventory.snapshot.stacks
      .filter(stack => stack.quantity > 0)
      .map(stack => {
        const display = materialDisplay(stack.stackKey);
        return { stackKey: stack.stackKey, name: display?.name ?? stack.stackKey, art: display?.art ?? '', qty: stack.quantity };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    this.chestView = { rows: this.chests.contents(at.areaId, at.index), satchel, slots: this.chests.slots, note };
  }
  chestPut(row: ChestRow): void {
    const at = this.panel?.chest;
    if (!at) return;
    const result = this.chests.put(at.areaId, at.index, row.stackKey);
    this.refreshChest(result.ok ? `${result.qty} ${row.name} put in the chest.` : result.message);
    this.refreshHotbar();
  }
  chestTake(row: ChestRow): void {
    const at = this.panel?.chest;
    if (!at) return;
    const result = this.chests.take(at.areaId, at.index, row.stackKey);
    this.refreshChest(result.ok ? `${result.qty} ${row.name} back in the satchel.` : result.message);
    this.refreshHotbar();
  }
  /** Chests whose Delve changed under them (a version bump, a merged seed) hand their contents back. */
  private refundOrphanChests(): void {
    if (!this.browser) return;
    const refunded = this.chests.refundOrphans((areaId, index) => this.engine?.nodeIdAt(areaId, index) ?? null);
    if (refunded) this.message = `The Delve shifted. ${refunded} things from a lost chest are back in your satchel.`;
  }
  /** The hotbar's Take back button: same as X. */
  takeBack(): void { this.engine?.takeBack(); }
  /** A break dropped a block: into the satchel, or crumbled when there is no room. Never refuses the dig. */
  private grantBlock(event: WorldActionEvent): void {
    if (!event.block) return;
    const name = materialDisplay(event.block)?.name ?? event.block;
    if (this.inventory.grantStack(`${event.mutationId}:block`, event.block, 1)) {
      this.toastLoot(`+1 ${name}`);
      this.refreshHotbar();
    } else this.message = `Your satchel is full, so the ${name.toLowerCase()} crumbles.`;
  }

  /**
   * A delve tool is about to break a paying cell. Ore goes through resolveMine
   * (same gate, cooldown and idempotency as the ore station); other yields are
   * granted idempotently by the engine's per-cell mutation id.
   * TODO: XP for non-mining actions needs a gateway sibling (resolveWorldAction).
   */
  private worldAction(event: WorldActionEvent): boolean {
    if (!this.browser) return false;
    // Plain dirt and placed blocks pay only the block.
    if (!event.xp && !(event.materialId && event.qty)) { this.grantBlock(event); return true; }
    if (event.kind === 'mine' && event.discipline === 'mining') {
      if (this.activity.snapshot.currentWork?.disciplineId === 'mining' && this.remaining > 0) {
        this.message = `The seam needs a breath (${this.remaining}s).`; return false;
      }
      if (!this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID)) { this.message = 'Mining could not be saved.'; return false; }
      const result = this.activity.resolveMine({ mutationId: event.mutationId, locationId: BASALT_SEAMWORKS_ID, oreId: event.materialId });
      this.now = Date.now();
      if (!result.ok) {
        this.message = result.code === 'capacity' ? 'Your bag is full.' : result.code === 'tier-locked' ? 'Your Mining level is too low for this vein.' : result.code === 'recovering' ? 'The seam needs a breath.' : 'That strike could not be saved. Swing again.';
        return false;
      }
      if (event.materialId) this.toastLoot(`+1 ${materialDisplay(event.materialId)?.name ?? event.materialId}`);
      this.grantBlock(event);
      return true;
    }
    // Everything else trains the skill the node belongs to (rock → Mining,
    // roots → Foraging, trunks → Woodcutting, walls and caches → Delving):
    // one idempotent gateway write grants the item and the XP together and
    // plays that skill's level-up moment.
    const skill = skillForDiscipline(event.discipline);
    if (!skill) { this.grantBlock(event); return true; }
    // A once-per-player find already paid (its diff was lost, or a second device
    // still showed it): the rock breaks, nothing is paid twice.
    const once = event.materialId && ONCE_PER_PLAYER.has(event.materialId) ? event.materialId : null;
    if (once && this.delve.isClaimed(once)) {
      this.message = `Only an echo is left here. You already found the ${materialDisplay(once)?.name ?? once}.`;
      return true;
    }
    const result = this.skillActions.act({
      mutationId: event.mutationId, skill: skill.id, xp: event.xp, locationId: EMBER_DELVE_LOCATION,
      ...(event.materialId && event.qty ? { materialId: event.materialId, qty: event.qty } : {}),
    });
    if (!result.ok) {
      this.message = result.code === 'capacity' ? 'Your satchel is full. Make room, then swing again.' : 'That swing could not be saved. Swing again.';
      return false;
    }
    if (once) this.delve.claim(once);
    if (event.materialId && event.qty) this.toastLoot(`+${event.qty} ${materialDisplay(event.materialId)?.name ?? event.materialId}`);
    this.grantBlock(event);
    return true;
  }
  /**
   * The Keeper read a carved wall. The first reading is recorded (for the
   * Archivist's missions and the Codex) and pays a little Delving XP, keyed by
   * the inscription so it can never pay twice; every reading shows the words.
   */
  private discover(event: DiscoverEvent): void {
    if (!this.browser || event.kind !== 'inscription') return;
    const text = inscriptionById(event.id)?.text ?? 'The carving is too worn to read.';
    const fresh = this.delveLore.recordInscription(event.id);
    if (fresh) {
      const result = this.skillActions.act({
        mutationId: `delve-inscription:${event.id}`, skill: 'delving', xp: INSCRIPTION_XP, locationId: EMBER_DELVE_LOCATION,
      });
      if (result.ok) this.toastLoot(`+${INSCRIPTION_XP} Delving XP`);
    }
    this.message = `${fresh ? 'New inscription. ' : ''}${text}`;
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
