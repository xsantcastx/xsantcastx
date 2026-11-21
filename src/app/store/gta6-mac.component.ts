/**
 * gta6-mac.component.ts — `/apps/decanter/gta-6-mac`: GTA 6 on Mac, honestly (see gta6-mac.seo.ts).
 * Prerendered, in Decanter's skin.
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GTA6_FAQ } from './gta6-mac.seo';
import { PROJECTS } from './projects.data';
import { StoreFooterComponent, StoreTopbarComponent } from './store-parts';

@Component({
  selector: 'app-gta6-mac',
  standalone: true,
  imports: [RouterLink, StoreTopbarComponent, StoreFooterComponent],
  templateUrl: './gta6-mac.component.html',
  styleUrl: './store.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gta6MacComponent {
  readonly faq = GTA6_FAQ;
  /** The current Decanter download (the same link as the Decanter page). */
  readonly download = PROJECTS.find(p => p.id === 'decanter')?.cta?.download ?? null;

  readonly stateLabel = { done: 'Done', doing: 'In progress', waiting: 'Waiting', no: 'Not expected' } as const;
  readonly status: { label: string; state: 'done' | 'doing' | 'waiting' | 'no'; text: string }[] = [
    { label: 'GTA 6 on PS5 and Xbox', state: 'done', text: 'Out since 19 November 2026.' },
    { label: 'GTA 6 on PC', state: 'waiting', text: 'Not announced yet. Reports point to early 2027.' },
    { label: 'DirectX 12 on Mac', state: 'done', text: 'Decanter runs DirectX 12 games through Apple\'s D3DMetal today (Path of Exile 2 runs at around 60 fps on an M5).' },
    { label: 'Controllers', state: 'done', text: 'Since Decanter 0.3, games see your Xbox controller and switch to controller mode (tested in Diablo II: Resurrected).' },
    { label: 'Room for a huge game', state: 'done', text: 'GTA V takes over 100 GB and GTA 6 will likely take more. Since Decanter 0.4, games can live on an external disk.' },
    { label: 'Rockstar Games Launcher', state: 'doing', text: 'Runs on Mac in our tests: it installs, sets up Social Club and opens its sign-in. That took a DirectX 10 fix (shipped in Decanter 0.4) and a drawing fix. Coming to Decanter\'s Launchers next.' },
    { label: 'Rehearsal with GTA V', state: 'doing', text: 'Next: GTA V\'s story mode through the Rockstar launcher in Decanter, so GTA 6 is a small step.' },
    { label: 'GTA 6 Online', state: 'no', text: 'Very likely blocked by anti-cheat that needs Windows itself, as GTA Online is today.' },
  ];
}
