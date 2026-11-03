/**
 * waystone-atlas.component.ts — the Waystones of a land (docs/design/world-acts.md §0; td-sections.ts): one stone a
 * section, a stone that remembers who touched it. Touching one opens this: every stone of the land, the ones touched
 * lit, the rest greyed "not found yet", and ONE big button that travels to the picked stone for free. The window round
 * it (title, close) is the play view's, as the Sailing Board's is.
 *
 * Station rule (memory: stations must be dummy-simple): one plain action. The travel itself is the host's (the engine).
 */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';

/** One stone of the land as the Atlas lists it. */
export interface AtlasStone { id: string; name: string; section: string; /** Where to look for it (an untouched stone's row). */ hint: string; band: readonly [number, number] | null; safe: boolean; known: boolean; here: boolean }

@Component({
  selector: 'app-waystone-atlas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waystone-atlas.component.html',
  styleUrl: './waystone-atlas.component.css',
})
export class WaystoneAtlasComponent implements OnChanges {
  private readonly i18n = inject(TranslationService);
  /** The land's stones, in the act's order. */
  @Input() stones: readonly AtlasStone[] = [];
  /** The Keeper picked a touched stone and pressed Travel: the host runs it. */
  @Output() readonly travel = new EventEmitter<string>();
  pick = '';

  ngOnChanges(): void {
    if (!this.stones.some(s => s.id === this.pick && s.known && !s.here)) this.pick = this.stones.find(s => s.known && !s.here)?.id ?? '';
  }
  get picked(): AtlasStone | undefined { return this.stones.find(s => s.id === this.pick); }
  get canGo(): boolean { const p = this.picked; return !!p && p.known && !p.here; }
  choose(s: AtlasStone): void { if (s.known && !s.here) this.pick = s.id; }
  go(): void { if (this.canGo) this.travel.emit(this.pick); }
  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }
}
