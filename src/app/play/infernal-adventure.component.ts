import {
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import {
  BASALT_SEAMWORKS_ID,
  CINDER_ORE_ID,
  EMBER_RESIDUE_ID,
} from '../shared/activity/activity.model';
import { InventoryService } from '../shared/rpg/inventory.service';
import { GameStateGateway } from '../shared/save/game-state.gateway';
import { INVENTORY_ERA } from '../shared/rpg/inventory.model';
import { RESET_STAMP_KEY } from '../shared/save/save-reset';
import { artFor } from '../shared/art/art';

const SAVE_KEY = 'eclipse-seamworks-opening-v1';
const CRAFT_ID = 'seamworks-opening:basalt-edge:v1';
type Place = 'seam' | 'forge' | 'bridge';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './infernal-adventure.component.html',
  styleUrls: ['./infernal-adventure.component.css'],
})
export class InfernalAdventureComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly store = inject(GameStateGateway);
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private timer?: ReturnType<typeof setInterval>;
  private pendingMine: string | null = null;
  place: Place = 'seam';
  message = 'The seam still glows. Start with one deliberate strike.';
  restored = false;
  fighting = false;
  health = 3;
  creatureHealth = 3;
  turn = 0;
  now = Date.now();
  bagOpen = false;

  ngOnInit(): void {
    this.inventory.init();
    this.activity.init();
    if (!this.browser) return;
    const saved = this.store.read(SAVE_KEY) as {
      era?: number;
      resetAt?: string | null;
      restored?: boolean;
    } | null;
    this.restored =
      saved?.restored === true &&
      saved.era === INVENTORY_ERA &&
      saved.resetAt === this.store.readRaw(RESET_STAMP_KEY);
    if (saved && !this.restored) this.store.remove(SAVE_KEY);
    if (this.restored) {
      this.place = 'bridge';
      this.message =
        'The beacon burns. The workers have returned to the crossing.';
    }
    this.timer = setInterval(() => (this.now = Date.now()), 100);
  }
  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  art(id: string): string {
    return artFor(id)?.src ?? '';
  }
  get ore(): number {
    return this.inventory.stackOf(CINDER_ORE_ID);
  }
  get ember(): number {
    return this.inventory.stackOf(EMBER_RESIDUE_ID);
  }
  get edge() {
    const edges = this.inventory.snapshot.items.filter(
      (item) => item.definitionId === 'basalt-edge' && !item.explorerId,
    );
    return edges.find((item) => item.equipped) ?? edges[0];
  }
  get equipped(): boolean {
    return !!this.edge?.equipped;
  }
  get remaining(): number {
    return Math.max(0, this.activity.recoveryRemainingMs(this.now));
  }
  get ready(): boolean {
    return this.ore >= 6 && this.ember >= 1;
  }
  get step(): number {
    return this.restored
      ? 4
      : this.equipped
        ? 3
        : this.edge
          ? 2
          : this.ore >= 6
            ? 1
            : 0;
  }
  get objective(): string {
    return [
      'Gather 6 Cinder Ore',
      'Bring the ore to the forge',
      'Equip your Basalt Edge',
      'Reclaim the crossing',
      'The Seamworks is stirring again',
    ][this.step];
  }
  get intent(): string {
    return this.turn % 2 === 0
      ? 'Its jaws flare. A heavy bite is coming.'
      : 'Its jaws are stuck in the stone. Strike now.';
  }
  visit(place: Place): void {
    this.place = place;
    this.message =
      place === 'seam'
        ? 'A vein of Cinder Ore runs beneath the cooled stone.'
        : place === 'forge'
          ? 'Six ore. One ember. Something worth holding onto.'
          : this.restored
            ? 'The crossing is open. Warm light reaches the far platform.'
            : 'A Rivet Maw guards the beacon. Watch its jaws before you act.';
  }
  mine(): void {
    if (!this.browser || this.remaining > 0) return;
    this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID);
    this.pendingMine ??= `opening-mine:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const result = this.activity.resolveMine({
      mutationId: this.pendingMine,
      locationId: BASALT_SEAMWORKS_ID,
      oreId: CINDER_ORE_ID,
    });
    if (result.ok) {
      this.pendingMine = null;
      this.message = `Cinder Ore +1. ${this.ore < 6 ? `${6 - this.ore} more for your first blade.` : 'Enough ore. The forge is ready for you.'}`;
    } else {
      this.message =
        result.code === 'capacity'
          ? 'Your bag is full. Make room at the bank, then return.'
          : result.code === 'persist'
            ? 'Your strike could not be saved. Try again to safely finish it.'
            : 'The seam needs a moment. Try again shortly.';
      if (result.code !== 'persist') this.pendingMine = null;
    }
    this.now = Date.now();
  }
  takeEmber(): void {
    if (!this.browser || this.ore < 6 || this.edge) return;
    const ok = this.inventory.grantStack(
      'seamworks-opening:keeper-ember:v1',
      EMBER_RESIDUE_ID,
      1,
    );
    this.message = ok
      ? this.ember > 0
        ? 'The Keeper lends you one Ember Residue. The forge has everything it needs.'
        : 'The Keeper already gave you this ember. Find more at the seam or visit the crafting bench.'
      : 'The ember could not be stored. Make room in your bag or try again.';
  }
  forge(): void {
    if (!this.browser || this.edge || !this.ready) return;
    const result = this.inventory.craftBasaltEdge(CRAFT_ID);
    this.message = result.ok
      ? 'The metal settles into a Basalt Edge. Your first blade is ready to equip.'
      : result.code === 'persist'
        ? 'The craft could not be saved. Your materials are safe; try again.'
        : result.code === 'capacity'
          ? 'Your bag needs an empty slot for the blade.'
          : 'The forge needs 6 Cinder Ore and 1 Ember Residue.';
  }
  equip(): void {
    if (!this.browser || !this.edge) return;
    this.message = this.inventory.equip(this.edge.id, 'weapon')
      ? 'Basalt Edge equipped. You are ready for the crossing.'
      : 'The blade could not be equipped. Try again.';
  }
  startFight(): void {
    if (!this.browser || !this.equipped || this.restored) return;
    this.fighting = true;
    this.health = 3;
    this.creatureHealth = 3;
    this.turn = 0;
    this.message = 'The Rivet Maw turns toward you. Read its movement.';
  }
  act(action: 'guard' | 'strike'): void {
    if (
      !this.browser ||
      !this.fighting ||
      !this.equipped ||
      this.health <= 0 ||
      this.creatureHealth <= 0
    )
      return;
    const biting = this.turn % 2 === 0;
    if (action === 'strike') this.creatureHealth -= 1;
    if (biting && action !== 'guard') this.health -= 2;
    this.turn += 1;
    if (this.health <= 0) {
      this.health = 0;
      this.creatureHealth = 3;
      this.fighting = false;
      this.message =
        'You retreat to the forge. Nothing was lost. Guard when its jaws flare, then strike.';
    } else if (this.creatureHealth <= 0) {
      this.fighting = false;
      this.message = 'The Rivet Maw retreats. The beacon is within reach.';
    } else
      this.message =
        action === 'guard'
          ? biting
            ? 'You turn the bite aside. The creature is exposed.'
            : 'You hold your ground, but the opening passes.'
          : biting
            ? 'Your blade lands, but the bite catches you.'
            : 'A clean strike against the exposed creature.';
  }
  restore(): void {
    if (!this.browser || this.creatureHealth > 0 || this.restored) return;
    const saved = {
      restored: true,
      era: INVENTORY_ERA,
      resetAt: this.store.readRaw(RESET_STAMP_KEY),
    };
    this.store.write(SAVE_KEY, saved);
    if (this.store.readRaw(SAVE_KEY) !== JSON.stringify(saved)) {
      this.message = 'The beacon could not be saved. Try lighting it again.';
      return;
    }
    this.restored = true;
    this.message =
      'The beacon answers. Across the chasm, the workers light their lamps. You brought the Seamworks back to life.';
  }
}
