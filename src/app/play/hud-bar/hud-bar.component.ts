/**
 * hud-bar.component.ts — the desktop bottom bar (the owner's Diablo II reference, in our wood and brass): the life orb
 * on the left, the mana orb on the right, and between them one framed panel with the XP strip along its top, a grid of
 * small menu buttons, the eight skill slots (two rows of four: 1–4 below, 5–8 above) and the potion belt.
 *
 * Phones keep their own touch layout (the HUD renders the old pieces there); this bar is for a keyboard and a mouse.
 * It owns no game state: it reads the HUD (`hud`) and calls its methods, so every cooldown, count and tooltip stays the
 * HUD's. The classes the specs know (.td-skills .td-skill .td-belt .td-pot .td-stone .td-dock [data-xp-bar]) are kept.
 * Keycaps come from the keymap (shared/keys), so a rebound key shows on its slot at once.
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { SideScrollerComponent } from '../side-scroller.component';

/** A filled pixel disc of `d` cells, as one path of row spans (crisp at any scale), offset by `off` cells. */
function disc(d: number, off: number): string {
  let out = '';
  for (let y = 0; y < d; y++) {
    const dy = y + 0.5 - d / 2, half = Math.sqrt(Math.max(0, (d / 2) ** 2 - dy * dy));
    const x0 = Math.round(d / 2 - half), w = Math.round(2 * half);
    if (w > 0) out += `M${off + x0} ${off + y}h${w}v1h${-w}z`;
  }
  return out;
}
const RING = disc(36, 0), WELL = disc(32, 2);
const SLOTS_TOP = [5, 6, 7, 8], SLOTS_BOTTOM = [1, 2, 3, 4];

@Component({
  selector: 'app-hud-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './hud-bar.component.html',
  styleUrls: ['./hud-bar.component.css'],
})
export class HudBarComponent {
  /** The play view: the bar reads its state and calls its methods. */
  @Input({ required: true }) hud!: SideScrollerComponent;
  readonly ring = RING;
  readonly well = WELL;
  readonly rows: readonly (readonly number[])[] = [SLOTS_TOP, SLOTS_BOTTOM];

  /** The filled share of an orb, 0..1, on a 5% grid (a life bar that moves in whole pixels, like the art). */
  fill(now: number, max: number): number { return Math.max(0, Math.min(1, Math.round((now / Math.max(1, max)) * 20) / 20)); }
  /** The orb's well is 32 cells tall inside the 36-cell frame: the top of the fill, in cells. */
  top(f: number): number { return 2 + 32 * (1 - f); }
  /** The ability on a slot (1–8), if one is put there. */
  ability(n: number) { return this.hud.tdAbilities[n - 1] ?? null; }
  t(key: string, params?: Record<string, string | number>): string { return this.hud.t(key, params); }
}
