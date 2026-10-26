/**
 * enchant-craft.component.ts — the Enchanting Table's recipes: charms, elixirs, oils and scrolls (crafting.model
 * recipeStation 'enchanting'). The crafting bench is gone (canon §6.2); this is the same recipe journal as Kael's
 * Anvil, opened from Idris Calder's table and showing only what is enchanted or brewed.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { STATION_UI } from '../station-ui';
import { ForgeFloorComponent } from '../forge-floor/forge-floor.component';
import { AnvilGameComponent } from '../minigames/anvil-game.component';
import { CRAFT_STATION, CraftingBenchComponent } from './crafting-bench.component';

@Component({
  selector: 'app-enchant-craft',
  standalone: true,
  imports: [ForgeFloorComponent, AnvilGameComponent, CommonModule, FormsModule, ...STATION_UI],
  templateUrl: './crafting-bench.component.html',
  styleUrls: ['./crafting-bench.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CRAFT_STATION, useValue: 'enchanting' }],
})
export class EnchantCraftComponent extends CraftingBenchComponent {}
